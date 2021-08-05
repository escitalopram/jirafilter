all: jirafilter.xpi
clean:
	rm jirafilter.xpi
jirafilter.xpi: background.js manifest.json options/options.html
	zip -r jirafilter.xpi background.js images manifest.json options
