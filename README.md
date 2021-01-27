# GitHub Star Sync Plugin

Synchronise Github stars with PostHog. Creates a new event for each star with the correct timestamp.

Requires PostHog 1.21+, so not currently usable outside of `master`.

It will still work with PostHog 1.20, but all stars will be created with the current timestamp instead of historic data.

## Setup via the PostHog

1. Find the "plugins" page in PostHog.
2. Either select the plugin from the list or copy the URL of this repository to install.
3. Configure the plugin:
   - Add the Github user/repo to sync. 
   - Optionally add a personal API key (helps with rate limits)
4. Enable the plugin.

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)
