# status-page-incidents

**How to tell researchers about a problem or planned work on the public status page.** The page
colours each component from our own checks. Only a person can say what is wrong, what a researcher
can do about it and when to expect news. You write that in Contentful. The status publisher reads
the published entries every minute, puts them on https://status.openjii.org and posts each change
to the status Slack channel.

## When to post

- Post when researchers would notice a problem for more than a few minutes. The checks may already
  have turned a component red, but they cannot say why or what to do.
- Post planned work that will interrupt researchers, before it starts.
- Post a problem you only learn of afterwards. Set the real start and end times. The entry appears
  in the details of every day it covers, and Slack gets it. It does not recolour a past day or
  change the availability figure, which come from the checks as they ran.
- Do not post a problem that one researcher reports on their own. Start with
  `measurement-missing.md`.

A first update that only says you are looking into it is a good update. Post it, then improve it.

## The components

Pick the components researchers would notice, not the ones where the cause lies. The ids are what
Contentful asks for.

| Id                 | Page name        | Researchers notice                                  | What they can do meanwhile                                                       |
| ------------------ | ---------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `website`          | Website          | The openJII website does not load.                  | Try again later.                                                                 |
| `sign-in`          | Sign-in          | They cannot sign in with an email code.             | Try again in a few minutes.                                                      |
| `platform`         | Platform         | The platform is slow or shows errors.               | Try again in a few minutes.                                                      |
| `data-intake`      | Data intake      | Measurements from devices or the app do not arrive. | Keep measuring. The app keeps readings it could not upload and sends them later. |
| `data-delivery`    | Data delivery    | New measurements do not appear in experiments.      | Wait. Add that measurements are safe only if an engineer has confirmed it.       |
| `macro-processing` | Macro processing | Macro results are late or missing.                  | Wait. Add that measurements are unaffected only if an engineer has confirmed it. |
| `exports`          | Exports          | A data export fails.                                | Try the export again later.                                                      |

## Post an incident

Open Contentful, add an entry of type Status incident and fill in these fields.

| Field                          | What to enter                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                          | What researchers see, in a few words, such as "Uploads from the field app are delayed". It appears alone in the day details, so it has to make sense alone. English. |
| Kind                           | `incident`.                                                                                                                                                          |
| Impact                         | `degraded` if the component is slow or only partly working. `outage` if it does not work.                                                                            |
| Affected components            | One or more ids from the table above.                                                                                                                                |
| Starts at                      | When researchers were first affected, as near as you can tell. It is not when you noticed. Never a time in the future.                                               |
| Planned end (maintenance only) | Empty.                                                                                                                                                               |
| Resolved at                    | Empty until the problem is fixed.                                                                                                                                    |
| Updates                        | The first update, created and linked from this field (see below).                                                                                                    |

An open incident holds its components at the impact you chose or worse. Our checks can raise a
component by themselves, but an incident never lowers one. If you choose `outage`, the component
shows Outage until you set Resolved at, even when the checks are green again.

Enter every time in UTC, because the page prints UTC. Set the time zone that Contentful shows beside
the time to UTC (+00:00).

To write the first update, use the Updates field to create a new entry and link it, and pick Status
update. Set Stage to `investigating`, Posted at to now, Next update by to a time you will keep, and
write the text with the templates below. Publish the update first, then the incident. Slack gets one
message when the incident first appears, so link the first update before that first publish.

## Add an update

Add an update whenever something changes and at the time you promised in Next update by, even if
nothing has changed. Open the incident, create a new entry in Updates, and fill in:

- Stage: `investigating`, `identified` or `monitoring`, whichever matches where things stand now.
  Go back to an earlier stage if you were wrong.
- Posted at: now. The page sorts updates by this time, newest first.
- Text: see the templates.
- Next update by: the time of the next update you will post. Leave it empty on the last update.

Write the next-update time in this field and not in the text. The page prints it under the newest
update. Publish the update, then publish the incident again so the new link goes live.

The newest update is the one shown in the list of past incidents, so the final update must make
sense on its own.

## Resolve an incident

1. Set Resolved at on the incident to the time the problem ended. A time that has not come yet
   keeps the incident open, on the page and in Slack, until it does.
2. Add an update with Stage `resolved`, Posted at now and no Next update by.
3. Publish the update, then the incident.

The component goes back to what our checks measure within about two minutes, and the incident moves
to Past incidents.

## Plan maintenance

Schedule it ahead, so the window is on the page before it starts.

1. Add a Status incident with Kind `maintenance`. Impact is required but the page ignores it for
   maintenance, so choose `degraded`.
2. Set Starts at and Planned end to the whole window, with some room at the end. Always set an end.
   Without one the component stays under maintenance until you set Resolved at.
3. Add an update with Stage `scheduled` and publish the update and the incident.
4. When the work starts, add an update with Stage `in-progress`.
5. When it ends, set Resolved at to the time you finished and add an update with Stage `completed`.

The affected components show Maintenance from Starts at until Planned end, or until Resolved at if
that comes first, and those minutes do not count against availability. The window opens and closes
by the clock, not by your updates. If the work runs over, move Planned end later before the old end
passes. Once it has passed, the component shows whatever the checks measure, which may be an outage.

To move a window, change the times and add a `scheduled` update with the new times. To cancel one,
set Resolved at and add a `completed` update that says the work is cancelled. There is no cancelled
stage.

## Post a notice

A notice is a banner above the headline. It has no component, no history and no stages, so use it
for information that is not an incident, such as a known problem with one kind of device or a
change coming next week. Notices reuse the `componentAlert` content type that the web and mobile
apps use for their banners, with a different audience.

1. Add an entry of the `componentAlert` content type.
2. Set Audience to `status`. Never `both`, which puts the notice in the web and mobile apps.
3. Set Severity to `info`, `warning` or `critical`. Use `warning` when researchers should plan
   around it and `critical` only when they must act now.
4. Write Title and Body in plain sentences. The page shows the body as plain text, so leave out
   formatting and links.
5. Set Start at, End at when the notice stops being true, and Active on.
6. Publish.

Type, Dismissible and Link do not appear on the status page. Fill in whatever Contentful requires.
Untick Active to take a notice down at once. The notice also goes to Slack.

## How long changes take

A published change appears on the page in about two minutes. The publisher runs every minute, the
data file is cached for 30 seconds, and an open page fetches it again every minute, so nobody needs
to reload. Slack gets its message when the publisher sees the change, in the same window.

## Slack

The status channel in Slack carries the changes as they happen, so support staff see them without
opening the page. The page is where the current state lives, and the channel is where you see what
changed and when.

### What the channel shows

The channel gets one message for each of these:

- An incident opened, updated or resolved.
- Planned maintenance scheduled, started, updated or completed.
- A component changing state on its own, when our checks turned it and no incident or planned
  window explains it. An open incident or window that names the component already says so.
- A notice posted or taken down.

Each message starts with a bold line saying what happened, such as "Incident opened: Uploads from
the field app are delayed". An incident's message then says the impact, "Impact: outage" or "Impact:
degraded", and the affected components by the names the page uses. After that come the newest
update's stage with the time it was posted, its text, the time of the next update, the planned
window for maintenance, a link to the page and the time of the change in UTC. A message about a
component changing state says the old and the new state.

Messages are flat. Slack gets no threads, and a message is never edited or deleted.

### What it does not show

- **Edits.** An update is posted once, when it first appears. Editing its text, stage or time
  afterwards does not post it again, so write a new update when something researchers could act on
  changes (see Correct a mistake).
- **The opening of an incident already open** when the channel was connected. The publisher sends
  its events to the topic from its own first run, whether or not a channel listens, so that incident
  has no "Incident opened" message. Its later updates arrive as "Incident updated" and "Incident
  resolved".
- **Long text in full.** A message holds about the first 2,500 characters of an update and ends with
  "...". The page shows the whole update, so keep updates short.
- **A message that Slack refused.** A failed post is tried twice more and then dropped, and the
  engineer on call is alerted. They post it by hand using `status-slack-errors.md`.
- **A guarantee of no repeats.** The channel skips an event it has just posted, but only while the
  same function instance is still running, so a message can occasionally appear twice.
- **A component still down when its incident is resolved.** It is not announced again, because the
  page shows it. The channel posts when the component recovers.

Messages arrive within about two minutes of the page changing, and two changes made in the same
minute may arrive in either order.

### Connect a channel

This is a one-time job for whoever administers Slack and the repository's GitHub secrets. Each
environment posts to the webhook it is given, so use a separate channel for dev, or leave dev
without one. Messages from any environment other than production name it in their footer.

1. Create the channel, for example one for status only, and decide who joins it.
2. In the Slack app that holds the repository's webhooks, or a new one, switch on Incoming Webhooks
   and choose Add New Webhook to Workspace. Pick the channel and copy the address that Slack shows.
   Treat it like a password, since anyone who has it can post to the channel.
3. Save the address as the GitHub secret `STATUS_SLACK_WEBHOOK_URL` for each environment that should
   post. For production, save it in the `prod-plan` GitHub environment as well, which is the one
   `pr.yml` uses for production plans. Without it, every pull request plan reads an empty address
   and shows the Slack resources being destroyed. Do not reuse `SLACK_WEBHOOK_URL`, which belongs to
   the monitoring channel.
4. Run the tofu workflow for the environment. While the secret is empty or unset, the apply creates
   nothing, so this is also how the feed is switched off. With the secret set, it stores the address
   in Secrets Manager as `openjii-status-slack-<env>` and creates the function that posts.
5. Post a test incident in dev as described under One-time setup, check that the channel gets it,
   then resolve it.

## If a change does not show

1. Check that the incident and every update show Published in Contentful, not Draft or Changed. The
   publisher reads published entries only, so a draft update stays off the page even when the
   incident is published.
2. Check the dates and time zones. An incident that starts in the future is not open yet. Resolved
   at must be after Starts at, except when you cancel planned work before it starts, where it is the
   moment you cancelled (see Plan maintenance).
3. Check that Kind, Impact and at least one component are set, and that no update is empty.
4. Wait the two minutes and reload.
5. Read the "Last checked" line under the page title. If it is more than five minutes old, or the
   headline reads "Status may be out of date", the publisher has stopped. Tell the engineer on call.
   They start from `status-publisher-stopped.md` and `status-publisher-errors.md`.

## Templates

Write for a researcher who may not read English as a first language. Use short sentences and plain
words. Say what is affected, what they can do meanwhile, and what happens next. Do not name internal
systems or providers, blame anyone, or promise a fix time, a cause or that data is safe unless an
engineer has confirmed it. Replace everything in square brackets.

### Investigating

> We are looking into a problem with [what researchers notice, for example: uploads from the field app]. [What may go wrong, for example: Measurements may arrive later than usual.] [What they can do meanwhile.]

### Identified

> We know what is wrong. [One plain sentence about what stopped working, not about who or what caused it.] We are working on a fix. [What they can do meanwhile.]

### Monitoring

> A fix is in place and [what now works]. We are watching it to make sure it keeps working. If you still see the problem, report it with the Report bug link in the platform.

### Resolved

> The problem is fixed. [Component] is working normally again. [What happened to work during the problem, for example: Measurements taken during this time have now arrived.] If you still see the problem, report it with the Report bug link in the platform.

State what happened to the researcher's work only if an engineer has confirmed it. Otherwise leave
that sentence out.

### Scheduled

> We will do planned work on [component] on [day, date] from [start] to [end] UTC. During this time [what will not work]. [What they can do instead.] The work may take longer than planned. We will post an update if it does.

### In progress

> The planned work on [component] has started. [What does not work now.] [What they can do meanwhile.]

If the work is running late, say so in an `in-progress` update, move Planned end and set Next update
by.

### Completed

> The planned work on [component] is finished and it is working normally again. If you still see a problem, report it with the Report bug link in the platform.

## Correct a mistake

The page follows edits. Change the entry, publish it, and the new text shows within about two
minutes. Slack posts each message once and never edits or deletes it, so an edit is invisible there.

- A typo, or a wrong time nobody acted on: edit the entry and publish. Editing an update, even its
  Posted at or Stage, never posts it to Slack again.
- Something a researcher could act on, such as a wrong component, a wrong maintenance time or a
  fix described before it happened: edit the entry, then add a new update that says what changed,
  for example "Correction to our earlier update. The planned work starts at 10:00 UTC, not 09:00
  UTC." The update is what Slack carries.
- An incident raised by mistake: add a `resolved` update that says it was raised in error and that
  nothing was affected, and set Resolved at. It stays in Past incidents as a record.
- A test entry: unpublish it. That takes it off the page, but Slack keeps the first message, so tell
  the channel yourself.

## One-time setup

For whoever adds the content types to Contentful. The repo has no script for this. The JSON files in
`packages/cms/content-models/` record the definitions, and an administrator applies them by hand in
each Contentful environment that a status publisher reads, as `apps/docs/content/developers/extending/public-navigation.mdx`
describes for the footer.

1. Create `statusUpdate` first and `statusIncident` second, because the incident links to the
   update type. In the Contentful content model, add a content type with the name from the JSON
   file. Set its API identifier to the file name, `statusUpdate` or `statusIncident`, because the
   publisher finds the types by that identifier. Then add each field with the id, type,
   localization, required flag and validations from the file, and set the display field the file
   names.
2. Open each Date field's appearance settings and choose date and time with time zone. A date
   without a time cannot say when an incident started.
3. Publish both content types.
4. Add `status` to the Audience values of `componentAlert`. That model is not in the repo, so this
   is a manual edit. Open the content type, open the Audience field, then Validation, add `status`
   to the accepted values, and save and publish the content type. Web and mobile cannot show a
   `status` alert. Their queries ask for `web` and `both`, or `mobile` and `both`, and the audience
   filter matches exactly (`apps/web/components/alerts-bar.tsx`,
   `apps/mobile/src/features/alerts/services/fetch-active-alerts.ts` and
   `packages/cms/src/lib/graphql/componentAlerts.graphql`).
5. Give everyone who posts incidents an editor role in the Contentful space. The built-in Editor
   role can create and publish entries but not change the content model, which needs an
   administrator. Give it to at least two people per duty rota and ask them to sign in once before
   they need it.
6. Create a test incident in the dev environment, check it on https://status.dev.openjii.org, then
   resolve it.
