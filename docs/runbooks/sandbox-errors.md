# sandbox-errors

**Macro executions are failing above their normal rate.** The sandbox runs user-authored code, so
some failure rate is permanent and expected: a researcher writing a macro will get it wrong, and
that is not an incident. This fires on a large deviation, which is why the first question is whether
the platform broke or one user is iterating.

## One macro or many

```bash
aws logs tail /aws/lambda/<env>-macro-<runtime> --since 1h --filter-pattern "ERROR"
```

The runtimes are separate functions, so start with whichever the digest named. Errors concentrated
on a single macro id are a user writing code, and the correct response is nothing. Errors spread
across many macro ids are the platform, and that is worth working.

## Platform-shaped causes

**A runtime image regression.** If the errors began with a `macro-sandbox` deploy and affect every
macro in one language while other languages are fine, that is the image.

**Concurrency exhaustion.** The pipeline executes macros in batches during enrichment, which can
saturate reserved concurrency and cause throttles rather than errors. Check the function's Throttles
metric alongside Errors; the two have different fixes and the digest reports them together.

**A data-shape change.** A macro that worked yesterday and fails today on unchanged code means its
input changed. That points at the pipeline, not the sandbox, and it usually affects every macro
reading the same parameter.

## The distinction that matters

"Macros are broken" and "a macro is broken" are different incidents with different audiences. Decide
which before telling anyone, because the second one is not an incident at all.

## Closing

If it was a single user's macro, close it without action and note that the threshold caught normal
iteration. If that keeps happening, the threshold is wrong and should be raised rather than
tolerated.
