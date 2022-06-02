Ticket: \<Add link to Jira issue here\>

\<your comments for this PR go here\>

Log any testing done, including none. A simple way to test is to:

```
gcloud app deploy --project=broad-shibboleth-prod --version=<your-version's-name> --no-promote
```

You may then run through the development flow using the link provided by the command above. If you need to also test the production flow, you may use the App Engine console to temporarily push traffic to your new version, run your test, then revert.

I, the developer opening this PR, do solemnly pinky swear that:

- [ ] I've updated the description of this change and its security impact in the Jira issue
- [ ] I've tested that the development workflow passes on a locally running instance

In all cases:

- [ ] Get two thumbs worth of review and PO sign off if necessary. 
- [ ] Squash and merge; you can delete your branch after this.
- [ ] Test this change deployed correctly and works after deployment
