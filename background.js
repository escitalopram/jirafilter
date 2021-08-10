var waitPeriod = 14400000;
var runinfo = {
	lastStart : null,
	lastFinish : null
}

function nonReentrantStarter() {
	if (runinfo.lastStart !== null && runinfo.lastFinish === null) {
		if (Date.now() - runinfo.lastStart < runinfo.waitPeriod) {
			return;
		} else {
			console.warn("Mailfilter: did not finish for a long period. Assuming crash and restarting.");
		}
	}
	runinfo.lastStart = Date.now();
	runinfo.lastFinish = null;
	doFilter();
}

function findFolder(folders, path) {
	var todo = [];
	if (folders) {
		folders.forEach(x=>todo.push(x));
	}
	while(todo.length > 0) {
		var current = todo.pop();
		if (current.path == path) {
			return current;
		}
		if (current.subFolders) {
			current.subFolders.forEach(x=>todo.push(x));
		}
	}
	return null;
}

function findHtmlPart(rootPart) {
	var todo = [rootPart];
	while(todo.length > 0) {
		var current = todo.pop();
		if (current.contentType=="text/html") {
			return current;
		}
		if (current.parts) {
			current.parts.forEach(x=>todo.push(x));
		}
	}
	return null;
}

function filterMeta(msg) {
	var author = msg.author;
	var subject = msg.subject;

	var jiraAuthor = author &&
		(author.endsWith(" (Jira)\" <jira@nexxar.com>") ||
			author.endsWith(" (Jira) <jira@nexxar.com>")
		);
	var earlyMatch = subject &&
			(subject.match(/^\[JIRA\] .* shared ".*" with you$/) ||
				subject.match(/^\[JIRA\] .* mentioned you on .* \(Jira\)/));
	if (jiraAuthor && earlyMatch) return true;
	var possibleMatch = jiraAuthor && subject && subject.match(/^\[JIRA\] \(/);
	if (possibleMatch) return null;
	return false;
}

async function filterFull(msg) {
	await browser.messages.getRaw(msg.id);
	var fullmsg = await browser.messages.getFull(msg.id);
	var htmlpart = findHtmlPart(fullmsg)
	var body = htmlpart.body
	var reassigned = body.match(/<tr>\s*<th [^>]*>Assignee:<\/th>\s*<td [^>]*> <span [^>]*class="diffremovedchars".*>[^<]+<\/span>\s*<span [^>]*class="diffaddedchars"[^>]*>Wolfgang Illmeyer<\/span>\s*<\/td>\s*<\/tr>/);
	var newassigned = body.match(/<tr>\s*<th [^>]*>Assignee:<\/th>\s*<td [^>]*>\s*<a [^>]*>Wolfgang Illmeyer<\/a>\s<\/td>\s*<\/tr>/);
	var done = body.match(/<tr>\s*<th [^>]*>(Epic )?Status:<\/th>\s*<td [^>]*> <span [^>]*class="diffremovedchars".*>[^<]+<\/span>\s*<span [^>]*class="diffaddedchars"[^>]*>Done<\/span>\s*<\/td>\s*<\/tr>/);
	var priotopchange = body.match(/<tr>\s*<th [^>]*">Priority:<\/th>\s*<td [^>]*>\s*<span class="diffremovedchars"[^>]*>[^<]*<\/span> <span class="diffaddedchars"[^>]*>High[^<]*<\/span>\s*<\/td>\s*<\/tr>/);
	var prioblockerchange = body.match(/<tr>\s*<th[^>]*>Priority:<\/th>\s*<td[^>]*>\s*<img[^>]*>\s*Blocker\s*<\/td>\s*<\/tr>/);
	if (reassigned || newassigned || done || priotopchange || prioblockerchange) {
		return true;
	}
	// console.log({reassigned: !!reassigned, newassigned: !!newassigned, done: !!done, priotopchange: !!priotopchange});
	return false;
}

function preFilterMsg(msg) {
	return !msg.flagged && !msg.read && msg.author.includes("<jira@nexxar.com>");
}

async function filterMessage(msg, assignment) {
	if(!preFilterMsg(msg)) {
		return;
	}
	var result = filterMeta(msg);
	if (result === null) {
		var fullres = await filterFull(msg);
		if (fullres === true) {
			assignment.accept.push(msg.id);
		} else if (fullres === false) {
			assignment.reject.push(msg.id);
		} else {
			assignment.other.push(msg.id);
		}
	} else if (result === false) {
		assignment.reject.push(msg.id);
	} else {
		assignment.accept.push(msg.id);
	}
	return null;
}

async function filterFolder(srcFolder, assignment) {
	var list = await browser.messages.query({folder: srcFolder, unread: true, flagged: false});
	await Promise.all(list.messages.map(x=>filterMessage(x, assignment)));
	while (list.id) {
		list = await browser.messages.continueList(list.id);
		await Promise.all(list.messages.map(x=>filterMessage(x, assignment)));
	}
	return null;
}

async function doFilter() {
	var acct = await browser.accounts.getDefault();
	var srcFolder = findFolder(acct.folders, "/INBOX");
	var rejFolder = findFolder(acct.folders, "/INBOX/Tickets");
	var assignment = {
		accept : [],
		reject : [],
		other : []
	}
	await filterFolder(srcFolder, assignment);
	assignment.reject.forEach(async x=>await browser.messages.update(x, {read: true}));
	await browser.messages.move(assignment.reject, rejFolder);
	assignment.accept.forEach(async x=>await browser.messages.update(x, {flagged: true}));
	runinfo.lastFinish = Date.now();
}



var interval = setInterval(nonReentrantStarter, 10000);
