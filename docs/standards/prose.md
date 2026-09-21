# Prose

Anything in this repo that a person reads comes under this document, which means comments and
TSDoc, log and error messages, the copy users see and its translations, commit subjects, pull
request bodies, and the standards in this directory.

Tickets and projects in Linear are the exception. They have their own headings and character budgets
in `docs/agents/ticket-standard.md`, and where the two documents overlap that one wins, because its
rules were written from the ways tickets here have actually gone wrong.

## Read first

The prose standard inside `docs/agents/ticket-standard.md` covers the same ground for Linear. The
`unslop` skill in `.agents/skills/unslop` is the pass to run over anything long before it ships.

## Rules

1. Write in sentences, each with a verb. A fragment, or a bold label and a colon standing in for a
   sentence, reads like notes you left yourself rather than something written for someone else.
   [review]
2. Do not use em dashes or en dashes anywhere. A comma, a colon or a full stop will do, and when
   none of them fits, the sentence usually wants splitting in two. [review]
3. Headings are sentence case, with no emoji in them. [review]
4. Keep to one idea per sentence. If you have to go back to the beginning of a sentence to work out
   what it says, so will everyone else. [review]
5. Use the ordinary word rather than the impressive one: use instead of utilise, help instead of
   facilitate, many instead of numerous, if instead of in the event that. [review]
6. Say who does the thing. "The loader parses the file" tells a reader where to look, and "the file
   is parsed" does not. Passive voice is fine when nobody knows or cares who acted. [review]

### Comments

7. Assume a comment is not needed until you can name the person who would look it up. If that
   person is only you, today, it is not needed. [review]
8. A comment is for what the code cannot say: why this order and not the obvious one, what breaks
   if someone changes it, which constraint outside the file forced this shape. If it restates the
   line below it, delete it. [review]
9. Write only what you have checked. Claims about how Postgres, drizzle, Spark or any framework
   behaves at runtime need a test behind them or an honest note that you have not verified it. A
   comment that is confidently wrong costs more than no comment at all. [review]
10. Leave the task, the ticket, the pull request and whoever asked for the change out of it. The
    comment will outlive all four. [review]
11. No divider comments and no section banners. Blank lines between blocks and well-named functions
    already do that job. [review]
12. Delete commented-out code, and anything half-written with a note promising the rest. Git still
    has it if you want it back. [review]
13. Never name an external or predecessor tool in the repo. Describe what the thing does instead.
    [review]

### TSDoc

14. Document exported functions, classes, components, hooks and types when the name and the
    signature leave something unsaid, and leave the obvious ones alone. [review]
15. One sentence is usually right and two is the limit. A function that needs several paragraphs is
    telling you it wants rewriting, not documenting. [review]
16. Leave out `@param` and `@returns` lines that only repeat the argument names. [review]
17. Skip property docs on a type that lives in one file or one feature, where the call site is a few
    lines away. On a type exported from `packages/*`, document a property when its name and type
    genuinely leave room for doubt, such as a `mode` field whose values need spelling out. [review]

### Logs and errors

18. Put the detail in the structured object rather than in the message text. In the backend that
    means an object carrying `msg` and `operation`, which is what makes the line searchable months
    later. [review]
19. An error a user can see should say what went wrong and what they can do about it. Skip the
    apology and the stack-trace vocabulary. [review]
20. Keep people out of log lines. An id is fine, but an email address, a name or a token is not,
    because logs end up in places the person never agreed to. [review]

### Copy users see

21. Every string a user sees goes through `@repo/i18n`, in each maintained locale, in the same
    change that introduces it. Variables interpolate as `{{name}}`. [review]
22. Do not pass fallback text into `t()`. A missing key is a bug worth fixing rather than one worth
    hiding at the call site. [review]
23. Call things what the reader calls them. A researcher has experiments, devices and protocols
    rather than resources and entities, and the glossary has the rest of the words. [review]
24. A button says what is about to happen and the message afterwards says what happened: "Publish",
    then "Published". [review]

### Commits and pull requests

25. A commit subject is one line in Conventional Commit form, with no body, no co-author trailer and
    no emoji. [review] [ci: Validate PR]
26. The pull request title is what the release tooling reads, so it takes the same form and
    describes the change rather than the branch. `CONTRIBUTING.md` has the rest, including the Linear
    relation lines. [ci: Linear ref check]
27. Write the body for somebody who has not seen the work: what changed, why, what you checked and
    how, and where a reviewer should start. [review]

### Writing to the person you are working with

28. Open with the outcome, meaning what is true now that was not true before. [review]
29. Keep what you verified apart from what you assumed, and label which is which. An assumption
    written as a finding is how someone ends up debugging the wrong thing. [review]
30. Below roughly 500 words use no headings at all, and above it use three at most. [review]
31. Say what the other person needs to do next, even when the answer is nothing. [review]
32. Cut the filler. Nobody needs "great question", "hope this helps", or their own request repeated
    back to them before the answer. [review]

## Patterns

`apps/backend/src/sharing/core/resource-staffing.ts` is worth reading for its comments. They explain
why string equality would silently disagree with the token comparison, and why a missing row means
an account is still open. Neither fact appears anywhere in the code, and working either of them out
again would cost an afternoon. The usual failure looks nothing like this: a comment that names the
statement underneath it.

`apps/mobile/docs/styling.md` is worth copying the shape of. In 91 lines it says what the app uses
for styling, lists the rules, gives a table of tokens, and closes with one sentence on what to do
when the tokens run out. It gives the rule and the way out, then stops.

Anything longer than a paragraph goes through the `unslop` skill before it ships. That is where the
puffery, the padded groups of three and the giveaway vocabulary come out.

## Known debt

Em dashes are the large one. 59 tracked markdown and MDX files contain them, the worst being
`apps/docs/content/guide/reference/access-troubleshooting.mdx` with 36 and `apps/mobile/CONTEXT.md`
with 30, and both `AGENTS.md` and `apps/web/TESTING.md` are in the list. Another 529 TypeScript,
TSX and Python files have them inside comments and TSDoc. None of that is worth sweeping, because
replacing an em dash changes the grammar around it and each one needs a person to decide, so fix
them in the files you were editing anyway. No ticket.

The exception is the 31 em dashes sitting in copy users actually read, spread over 8 shared locale
files with 12 in `en-US`, 9 in `de-DE` and 10 in `nl-NL`, plus 2 more in the mobile locales. That
set is small enough to fix in one pass, and it is the only part of this debt a researcher ever sees.
Needs a ticket.

Nothing checks for em dashes today, so more keep arriving. The plan is a CI step that looks only at
the lines a pull request adds, which keeps the 588 files already in the tree from blocking it on the
first day. Needs a ticket.

`CONTRIBUTING.md` and `apps/docs/content/developers/contributing/index.mdx` are two hand-maintained
copies of the same guide, and they already disagree about which commands verify a change.
`CONTRIBUTING.md` should stay the real one and the published page should shrink to a pointer. Needs
a ticket.

Two rules need no debt line, because the repo already keeps them. There are no divider comments in
it, and only two files contain a TODO or a FIXME.

## Decisions

- 2026-09-21. Em dashes are banned rather than discouraged, and the check will only ever look at
  added lines. A check across the whole tree would have failed on 588 files the day it landed, and
  somebody would have turned it off inside a week.
- 2026-09-21. This document owns prose for the repo, while `docs/agents/ticket-standard.md` keeps
  owning prose written into Linear, because its budgets and heading sets only mean anything there.
