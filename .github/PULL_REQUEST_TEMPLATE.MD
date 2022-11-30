Ticket: \<Add link to Jira issue here\>

  \<Don't forget to include the ticket number in the PR title.\>

What:

  \<For your reviewers' sake, please describe in a sentence or two what this PR is accomplishing (usually from the users' perspective, but not necessarily).\>

Why:

  \<For your reviewers' sake, please describe in ~1 paragraph what the value of this PR is to our users or to ourselves.\>

How:

  \<For your reviewers' sake, please describe in ~1 paragraph how this PR accomplishes its goal.\>

  \<If the PR is big, please indicate where a reviewer should start reading it (i.e. which file or function).\>

---

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
- [ ] Test this change deployed correctly and works after deployment. You can see if it has deployed with your fc account using this [link to the instance list in the gcp console](https://console.cloud.google.com/appengine/versions?serviceId=default&project=broad-shibboleth-prod). Then you can test the **dev flow** from the [prod Shibboleth instance](https://broad-shibboleth-prod.appspot.com/). To test the **prod flow**, link your NIH Account from the [Terra Profile page](https://app.terra.bio/#profile) and verify that the link expiration date gets updated.
