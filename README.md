A thunderbird plugin that separates interesting mails out of the Jira spam.

Interesting emails are contain notifications about:
- status set to Done
- ticket assigned to the user
- priority set to High/Highest
- something was shared with the user
- mentions of the user

Filtering works by moving the unintersting jira spam into a separate folder and marking it as read. Interesting jira mails are flagged and left in the inbox.

**WARNING**:
* All Folder names, the user name, jira email address,  the filter conditions, as well as the frequency of the filtering  are *hardcoded*. No settings are available.
* The filtering needs to inspect the HTML of the emails, so it might fail if the mail templates in Jira are changed (which implies that possibly all mails will be considered unimportant)
