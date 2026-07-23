#!/usr/bin/env Rscript
# Canonical-measurement contract guard (R).
# Classifies each item's data by inspecting the RAW JSON container kind before
# any jsonlite simplification, so {} and [] receive different decisions. It never
# re-shapes a value. Modes: "shadow" (report only) and "enforce".

GUARD_INPUT_CONTRACT <- "canonical-measurement-v1"
GUARD_MODES <- c("shadow", "enforce")
GUARD_CLASSIFICATIONS <- c("canonical", "empty-envelope", "non-canonical-envelope")
GUARD_MARKER_ERROR_CODE <- "unsupported-input-contract"

# Per-item error code for a non-canonical classification, or NA for canonical.
guard_error_for <- function(classification) {
  if (identical(classification, "empty-envelope")) return("empty-envelope")
  if (identical(classification, "non-canonical-envelope")) return("non-canonical-input")
  NA_character_
}

guard_marker_valid <- function(input_contract) {
  !is.null(input_contract) && identical(as.character(input_contract), GUARD_INPUT_CONTRACT)
}

# Decode JSON string escapes (\uXXXX, \n, \t, \", \\, ...) so an escaped object
# key such as "sample" compares equal to "sample". Falls back to the raw
# text on any decode error.
.guard_decode_json_string <- function(s) {
  if (!grepl("\\", s, fixed = TRUE)) return(s)
  tryCatch({
    chars <- strsplit(s, "")[[1]]
    n <- length(chars)
    out <- character(0)
    i <- 1
    while (i <= n) {
      ch <- chars[i]
      if (ch == "\\" && i < n) {
        nx <- chars[i + 1]
        if (nx == "u" && i + 5 <= n) {
          hex <- paste0(chars[(i + 2):(i + 5)], collapse = "")
          out <- c(out, intToUtf8(strtoi(hex, 16L)))
          i <- i + 6
          next
        }
        out <- c(out, switch(nx,
          "n" = "\n", "t" = "\t", "r" = "\r", "b" = "\b", "f" = "\f",
          "\"" = "\"", "\\" = "\\", "/" = "/", nx))
        i <- i + 2
        next
      }
      out <- c(out, ch)
      i <- i + 1
    }
    paste0(out, collapse = "")
  }, error = function(e) s)
}

.guard_is_ws <- function(ch) ch %in% c(" ", "\t", "\n", "\r")

.guard_skip_ws <- function(chars, i, n) {
  while (i <= n && .guard_is_ws(chars[i])) i <- i + 1
  i
}

# Index just after the closing quote of a string starting at chars[i] == '"'.
.guard_string_end <- function(chars, i, n) {
  i <- i + 1
  while (i <= n) {
    ch <- chars[i]
    if (ch == "\\") { i <- i + 2; next }
    if (ch == "\"") return(i + 1)
    i <- i + 1
  }
  i
}

# Index just after a complete JSON value whose first char is at chars[i].
.guard_value_end <- function(chars, i, n) {
  ch <- chars[i]
  if (ch == "\"") return(.guard_string_end(chars, i, n))
  if (ch == "{" || ch == "[") {
    depth <- 0
    while (i <= n) {
      c2 <- chars[i]
      if (c2 == "\"") { i <- .guard_string_end(chars, i, n); next }
      if (c2 == "{" || c2 == "[") {
        depth <- depth + 1
      } else if (c2 == "}" || c2 == "]") {
        depth <- depth - 1
        if (depth == 0) return(i + 1)
      }
      i <- i + 1
    }
    return(i)
  }
  while (i <= n && !(chars[i] %in% c(",", "}", "]", " ", "\t", "\n", "\r"))) i <- i + 1
  i
}

# Raw substring of a depth-1 member value for `key`, or NULL if absent/not object.
.guard_member_raw <- function(s, key) {
  chars <- strsplit(s, "")[[1]]
  n <- length(chars)
  i <- .guard_skip_ws(chars, 1, n)
  if (i > n || chars[i] != "{") return(NULL)
  i <- i + 1
  repeat {
    i <- .guard_skip_ws(chars, i, n)
    if (i > n || chars[i] == "}") break
    if (chars[i] != "\"") break
    key_start <- i
    key_end <- .guard_string_end(chars, i, n)
    k <- .guard_decode_json_string(substr(s, key_start + 1, key_end - 2))
    i <- .guard_skip_ws(chars, key_end, n)
    if (i > n || chars[i] != ":") break
    i <- .guard_skip_ws(chars, i + 1, n)
    if (i > n) break
    val_start <- i
    val_end <- .guard_value_end(chars, i, n)
    if (identical(k, key)) return(trimws(substr(s, val_start, val_end - 1)))
    i <- .guard_skip_ws(chars, val_end, n)
    if (i <= n && chars[i] == ",") { i <- i + 1; next }
    break
  }
  NULL
}

# Raw substrings of a top-level array's elements (empty list if not an array).
guard_array_elements_raw <- function(s) {
  s <- trimws(s)
  chars <- strsplit(s, "")[[1]]
  n <- length(chars)
  if (n == 0 || chars[1] != "[") return(list())
  i <- 2
  elems <- list()
  repeat {
    i <- .guard_skip_ws(chars, i, n)
    if (i > n || chars[i] == "]") break
    val_start <- i
    val_end <- .guard_value_end(chars, i, n)
    elems[[length(elems) + 1]] <- trimws(substr(s, val_start, val_end - 1))
    i <- .guard_skip_ws(chars, val_end, n)
    if (i <= n && chars[i] == ",") { i <- i + 1; next }
    break
  }
  elems
}

.guard_is_empty_array <- function(v) grepl("^\\[\\s*\\]$", v)

# Classify one item's data supplied as its raw JSON string.
guard_classify_raw <- function(data_json) {
  s <- trimws(data_json)
  if (nchar(s) == 0) return("canonical")
  first <- substr(s, 1, 1)
  if (first == "[") {
    if (.guard_is_empty_array(s)) return("empty-envelope")
    return("non-canonical-envelope")
  }
  if (first == "{") {
    sample_raw <- .guard_member_raw(s, "sample")
    if (is.null(sample_raw)) return("canonical")
    sfirst <- substr(sample_raw, 1, 1)
    if (sfirst == "[") {
      if (.guard_is_empty_array(sample_raw)) return("empty-envelope")
      return("non-canonical-envelope")
    }
    if (sfirst == "{") return("non-canonical-envelope")
    return("canonical")
  }
  "canonical"
}

# Given the raw event JSON text, return each item's data classification in order.
guard_classify_event_items <- function(raw_event) {
  items_raw <- .guard_member_raw(raw_event, "items")
  if (is.null(items_raw)) return(character(0))
  elements <- guard_array_elements_raw(items_raw)
  vapply(elements, function(el) {
    data_raw <- .guard_member_raw(el, "data")
    if (is.null(data_raw)) data_raw <- "null"
    guard_classify_raw(data_raw)
  }, character(1))
}

# Content-free shadow telemetry summary (a list suitable for jsonlite/cat).
guard_build_telemetry <- function(input_contract, marker_valid, ids, classifications, mode) {
  counts <- list(
    canonical = sum(classifications == "canonical"),
    "empty-envelope" = sum(classifications == "empty-envelope"),
    "non-canonical-envelope" = sum(classifications == "non-canonical-envelope")
  )
  empty_ids <- ids[classifications == "empty-envelope"]
  non_canonical_ids <- ids[classifications == "non-canonical-envelope"]
  list(
    event = "macro-guard",
    mode = mode,
    # Bounded facts only. Never echo the caller-supplied marker value.
    markerPresent = is.character(input_contract) && length(input_contract) == 1,
    markerValid = marker_valid,
    itemCount = length(classifications),
    counts = counts,
    emptyEnvelopeIds = as.list(empty_ids),
    nonCanonicalIds = as.list(non_canonical_ids)
  )
}

# Reassemble strictly by original position, never by id, so duplicate and empty
# item IDs round-trip losslessly. executed_results are ordered by the canonical
# items; invalid_results by the rest.
guard_merge_positional <- function(classifications, executed_results, invalid_results) {
  merged <- vector("list", length(classifications))
  vi <- 1
  ii <- 1
  for (k in seq_along(classifications)) {
    if (classifications[k] == "canonical") {
      merged[[k]] <- executed_results[[vi]]
      vi <- vi + 1
    } else {
      merged[[k]] <- invalid_results[[ii]]
      ii <- ii + 1
    }
  }
  merged
}

# CLI conformance runner mirroring guard.js/guard.py. Runs only when guard.R is
# the invoked script, not when sourced by a handler.
.guard_is_main <- function() {
  fa <- grep("--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
  length(fa) > 0 && grepl("guard\\.R$", sub("--file=", "", fa[1]))
}
if (.guard_is_main()) {
  args <- commandArgs(trailingOnly = TRUE)
  marker_idx <- match("--marker", args)
  enforce_idx <- match("--enforce", args)
  if (!is.na(marker_idx)) {
    value <- if (marker_idx < length(args)) args[marker_idx + 1] else NA
    cat(tolower(as.character(guard_marker_valid(value))), "\n", sep = "")
  } else {
    input <- file("stdin", "r")
    lines <- readLines(input, warn = FALSE)
    close(input)
    lines <- lines[nchar(trimws(lines)) > 0]

    if (!is.na(enforce_idx)) {
      marker <- if (enforce_idx < length(args)) args[enforce_idx + 1] else NA
      if (!guard_marker_valid(marker)) {
        cat("MARKER_INVALID\t", GUARD_MARKER_ERROR_CODE, "\n", sep = "")
      } else {
        ids <- character(0)
        classifications <- character(0)
        for (line in lines) {
          tab_pos <- regexpr("\t", line, fixed = TRUE)
          if (tab_pos == -1) {
            id <- line
            data_raw <- ""
          } else {
            id <- substr(line, 1, tab_pos - 1)
            data_raw <- substr(line, tab_pos + 1, nchar(line))
          }
          ids <- c(ids, id)
          classifications <- c(classifications, guard_classify_raw(data_raw))
        }
        valid_idx <- which(classifications == "canonical")
        invalid_idx <- which(classifications != "canonical")
        executed <- lapply(valid_idx, function(i) list(id = ids[i], success = TRUE, error = NA_character_))
        invalids <- lapply(invalid_idx, function(i) list(id = ids[i], success = FALSE, error = guard_error_for(classifications[i])))
        merged <- guard_merge_positional(classifications, executed, invalids)
        out <- vapply(merged, function(r) {
          paste0(r$id, "\t", tolower(as.character(r$success)), "\t", if (is.na(r$error)) "-" else r$error)
        }, character(1))
        if (length(out) > 0) cat(paste(out, collapse = "\n"), "\n", sep = "")
      }
    } else {
      out <- vapply(lines, function(line) {
        cls <- guard_classify_raw(line)
        err <- guard_error_for(cls)
        paste0(cls, "\t", if (is.na(err)) "-" else err)
      }, character(1))
      if (length(out) > 0) cat(paste(out, collapse = "\n"), "\n", sep = "")
    }
  }
}
