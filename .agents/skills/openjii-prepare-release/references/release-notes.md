# Write the release note

One note per release, written for researchers in a plain, factual voice. It reads like a changelog
in full sentences: what changed and where to find it, without selling it.

## Shape

- **Title.** Name the two or three largest changes in plain words, such as "New home page,
  notifications and join codes". No slogans or wordplay.
- **Summary.** One or two sentences listing the main changes for each surface.
- **Opening line.** One sentence saying which surfaces the release covers and, if the app ships, the
  Android version: "This release updates the web platform and the Android app, which moves to
  version 2.87.0."
- **Sections.** One heading per area, named for the area: Home, Notifications, Privacy, Data and
  charts, Performance, Android app. Put the areas most researchers will notice first.
- **Body.** One or two short paragraphs per section. Write prose, not bullet lists.

One note covers web and Android when both ship together. Publish it once both are live, as the skill
requires. If the Android build cannot reach production on the same day, leave its sections out and
add them when it does.

## Voice

- State what changed and where it is: "The experiments list can be filtered by status and
  visibility." Avoid imperatives and promises such as "Filter your lists" or "you can now".
- Use "you" only when a sentence is about the reader's own work, as in "the five experiments you
  opened most recently".
- Do not sell. No slogans, rhetorical questions or exclamation marks, and no words like "finally",
  "seamless" or "rebuilt around you".
- Describe a fix by what the researcher sees, not by its cause: "Large JSON exports no longer fail",
  not the message size limit that made them fail. Leave out infrastructure, vendors, queues, file
  sizes and internal names unless a researcher needs them to act.
- Use the product's own labels for screens and controls, such as the Collaborators tab or the
  Notifications page.
- Put each fix in the section for the area it affects. There is no separate list of fixes.
- Write full sentences, and use no em dashes.

Run `unslop` for its pattern checks, but keep this page's voice. Its advice to add personality and
opinions does not apply to a release note.

## What to leave out

- Pending PRs and work still behind a flag that people outside the team cannot reach.
- CI, dependency, monitoring and documentation-only changes, and anything else a researcher cannot
  see or use.
- Features already announced in an earlier note, unless this release changes them.

## Pictures

- Give a picture to a change that is visual and new, such as a redesigned page, a new dialog or a
  new flow. A change that one sentence explains completely, such as a filter, a settings switch or a
  fix, goes without one.
- Show a flow that spans two surfaces as a matched pair: the organizer's screen and the
  participant's, with the same values in both frames.
- Keep captions to a few plain words that say what the picture shows: "The join code dialog on the
  web."

[Capture release media](media.md) covers how to take and review the frames.

## Before and after

| Avoid                                                             | Write                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Your work up front, and a whole room joined in one scan           | New home page, notifications and join codes                                               |
| Two and a half weeks of work land in this release.                | This release updates the web platform and the Android app, which moves to version 2.87.0. |
| Hear when something needs you                                     | Notifications                                                                             |
| JSON exports larger than 128 MiB no longer fail at the write.     | Large JSON exports no longer fail.                                                        |
| An email that fails to send is tried again instead of being lost. | Emails that fail to send are retried.                                                     |
