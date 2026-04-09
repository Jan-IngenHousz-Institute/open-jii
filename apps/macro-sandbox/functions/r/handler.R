#!/usr/bin/env Rscript
# Lambda handler for R macro execution.
# Called by the bootstrap: Rscript handler.R <event_file>

suppressPackageStartupMessages({
  library(jsonlite)
})

# Limits
MAX_SCRIPT_SIZE <- 1048576  # 1MB
MAX_ITEM_COUNT  <- 1000
MAX_TIMEOUT     <- 60
DEFAULT_TIMEOUT <- 10

WRAPPER_PATH <- "/var/task/wrappers/wrapper.R"

# Read event file path from command args
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  cat(toJSON(list(status = "error", results = list(), errors = list("No event file provided")), auto_unbox = TRUE))
  quit(status = 0)
}

event_file <- args[1]

# Parse event
event <- tryCatch({
  fromJSON(event_file, simplifyVector = FALSE)
}, error = function(e) {
  cat(toJSON(list(status = "error", results = list(), errors = list(paste0("Failed to parse event: ", e$message))), auto_unbox = TRUE))
  quit(status = 0)
})

# Validate script
if (is.null(event$script)) {
  cat(toJSON(list(status = "error", results = list(), errors = list("Missing 'script' field")), auto_unbox = TRUE))
  quit(status = 0)
}

# Decode base64 script
script_bytes <- tryCatch({
  base64_dec(event$script)
}, error = function(e) {
  cat(toJSON(list(status = "error", results = list(), errors = list("Invalid base64 in 'script'")), auto_unbox = TRUE))
  quit(status = 0)
})

if (length(script_bytes) > MAX_SCRIPT_SIZE) {
  cat(toJSON(list(status = "error", results = list(), errors = list("Script exceeds 1MB limit")), auto_unbox = TRUE))
  quit(status = 0)
}

script_content <- rawToChar(script_bytes)

# Validate items
items <- event$items
if (is.null(items)) items <- list()
if (!is.null(names(items))) {
  cat(toJSON(list(status = "error", results = list(), errors = list("'items' must be an array, not an object")), auto_unbox = TRUE))
  quit(status = 0)
}
if (length(items) > MAX_ITEM_COUNT) {
  cat(toJSON(list(status = "error", results = list(), errors = list(paste0("Exceeds ", MAX_ITEM_COUNT, " item limit"))), auto_unbox = TRUE))
  quit(status = 0)
}

timeout <- max(DEFAULT_TIMEOUT, min(as.numeric(ifelse(is.null(event$timeout), DEFAULT_TIMEOUT, event$timeout)), MAX_TIMEOUT))

# Warm-start cleanup: remove leftover temp dirs from crashed invocations.
for (d in Sys.glob("/tmp/macro_*")) {
  unlink(d, recursive = TRUE)
}

# Write temp files
tmpdir <- tempfile(pattern = "macro_", tmpdir = "/tmp")
dir.create(tmpdir)
script_path <- file.path(tmpdir, "script")
input_path <- file.path(tmpdir, "input.json")
output_path <- file.path(tmpdir, "output.json")

writeLines(script_content, script_path)
writeLines(toJSON(items, auto_unbox = TRUE), input_path)

# Run wrapper in a subprocess with stripped environment (env -i).
# Output file (3rd arg) prevents user cat()/print() from corrupting JSON.
result <- tryCatch({
  exit_code <- system2(
    "env",
    args = c(
      "-i",
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "HOME=/tmp",
      "timeout", as.character(timeout + 5),
      "Rscript", WRAPPER_PATH, script_path, input_path, output_path
    ),
    stdout = FALSE,
    stderr = FALSE
  )

  if (exit_code == 124) {
    list(status = "error", results = list(), errors = list("Execution timed out"))
  } else if (file.exists(output_path)) {
    output_size <- file.info(output_path)$size
    if (output_size > 10 * 1024 * 1024) {
      list(status = "error", results = list(), errors = list("Wrapper output exceeds 10MB limit"))
    } else {
      output_str <- paste(readLines(output_path, warn = FALSE), collapse = "\n")
      if (nchar(output_str) > 0) {
        fromJSON(output_str, simplifyVector = FALSE)
      } else {
        list(status = "error", results = list(), errors = list("Wrapper returned no output"))
      }
    }
  } else {
    list(status = "error", results = list(), errors = list("Wrapper produced no output file"))
  }
}, error = function(e) {
  list(status = "error", results = list(), errors = list(paste0("Execution failed: ", e$message)))
})

# Clean up
unlink(tmpdir, recursive = TRUE)

cat(toJSON(result, auto_unbox = TRUE))
