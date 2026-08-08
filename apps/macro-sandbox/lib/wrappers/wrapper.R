#!/usr/bin/env Rscript

# 1. SETUP & LIBRARIES
suppressPackageStartupMessages({
  library(jsonlite)
})

# Args: [1]=UserScriptPath, [2]=InputDataPath, [3]=OutputFilePath (optional)
args <- commandArgs(trailingOnly = TRUE)
user_script_path <- args[1]
input_data_path <- args[2]
output_file_path <- args[3]  # Optional: write JSON here instead of stdout

# Helper: emit error JSON to output file (Lambda) or stdout (local), then exit.
emit_error_and_exit <- function(msg) {
  json <- toJSON(list(status = "error", results = list(), errors = list(msg)), auto_unbox = TRUE)
  if (!is.na(output_file_path) && nchar(output_file_path) > 0) {
    writeLines(json, output_file_path)
  } else {
    cat(json)
  }
  quit(status = 0)
}

# Load Helpers
# Get the directory of this wrapper script
wrapper_script <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("--file=", wrapper_script, value = TRUE)
if (length(file_arg) > 0) {
  wrapper_path <- sub("--file=", "", file_arg)
  wrapper_dir <- dirname(wrapper_path)
} else {
  # Fallback for sourced scripts
  wrapper_dir <- getwd()
}
helpers_path <- file.path(wrapper_dir, "../src/helpers/helpers.R")

if (!file.exists(helpers_path)) {
  emit_error_and_exit(paste0("Helpers file not found at: ", helpers_path))
}
# Create an isolated parent env for sandbox scopes.
# Macros get standard R functions (sd, lm, optim, ...) but can't
# see the wrapper's own variables.
sandbox_parent <- new.env(parent = parent.env(globalenv()))
source(helpers_path, local = sandbox_parent)
lockEnvironment(sandbox_parent)

# 2. READ INPUT BATCH
if (!file.exists(input_data_path)) {
  emit_error_and_exit("Input file not found")
}

# Read JSON batch
batch_items <- fromJSON(input_data_path, simplifyVector = FALSE)
# Result list
results <- list()
fingerprints <- list()

# 3. PREPARE USER CODE
# Reading the user script content
user_code <- readLines(user_script_path, warn = FALSE)
user_code_str <- paste(user_code, collapse = "\n")

# Wrap user code in a function to support return statements
# Indent each line of user code
indented_code <- paste0("  ", gsub("\n", "\n  ", user_code_str))

wrapped_code <- paste0(
  "execute_macro <- function() {\n",
  indented_code, "\n",
  "}\n",
  "\n",
  "macro_result <- execute_macro()\n",
  "if (is.list(macro_result)) {\n",
  "  output <- c(output, macro_result)\n",
  "}\n"
)

# Parse once before the loop
parse_error <- NULL
parsed_code <- tryCatch(
  parse(text = wrapped_code),
  error = function(e) {
    parse_error <<- as.character(e$message)
    NULL
  }
)

# Match JavaScript's typeof strings for values representable in JSON.
json_typeof <- function(value) {
  if (is.null(value) || is.list(value)) return("object")
  if (is.logical(value)) return("boolean")
  if (is.character(value)) return("string")
  if (is.numeric(value)) return("number")
  typeof(value)
}

is_json_array <- function(value) {
  is.list(value) && is.null(names(value))
}

known_top_level_keys <- c(
  "set", "macros", "protocol_id", "sample", "gps", "data", "output",
  "time", "timestamp", "latitude", "longitude", "questions", "annotations",
  "device", "protocol", "id"
)

# FNV-1a 32-bit over UTF-8 bytes. Keep the hash as an exactly-representable
# double and decompose multiplication by 16777619 into 403 + 2^24 so no
# intermediate exceeds the integer precision of an R double.
fingerprint_digest <- function(value) {
  modulus <- 4294967296
  hash <- 2166136261
  for (byte in as.integer(charToRaw(enc2utf8(value)))) {
    low_byte <- hash %% 256
    hash <- hash - low_byte + bitwXor(as.integer(low_byte), byte)
    hash <- (hash * 403 + (hash %% 256) * 16777216) %% modulus
  }
  high <- as.integer(floor(hash / 65536))
  low <- as.integer(hash %% 65536)
  paste0("#", sprintf("%04x", high), sprintf("%04x", low))
}

redact_key <- function(key) {
  if (key %in% known_top_level_keys) key else fingerprint_digest(key)
}

redact_label <- function(label) {
  if (grepl("^[A-Za-z0-9_-]{1,24}$", label, perl = TRUE)) label else fingerprint_digest(label)
}

javascript_sort_keys <- function(keys) {
  if (length(keys) < 2) return(keys)
  sort_key <- function(value) {
    utf16 <- iconv(value, from = "UTF-8", to = "UTF-16BE", toRaw = TRUE)[[1]]
    paste(sprintf("%02x", as.integer(utf16)), collapse = "")
  }
  keys[order(vapply(keys, sort_key, character(1)), method = "radix")]
}

build_shape_fingerprint <- function(item) {
  data <- item$data
  is_array <- is_json_array(data)
  is_record <- is.list(data) && !is_array
  has_set <- is_record && "set" %in% names(data)
  set_value <- if (has_set) data$set else NULL
  set_is_array <- is_json_array(set_value)
  set_typeof <- if (!has_set) {
    "undefined"
  } else if (is.null(set_value)) {
    "null"
  } else if (set_is_array) {
    "array"
  } else {
    json_typeof(set_value)
  }
  set_labels <- if (set_is_array) {
    unname(Filter(
      Negate(is.null),
      lapply(set_value, function(entry) {
        if (is.list(entry) && is.character(entry$label) && length(entry$label) == 1) {
          redact_label(entry$label)
        } else {
          NULL
        }
      })
    ))
  } else {
    list()
  }

  list(
    msg = "Macro input shape fingerprint",
    operation = "executeMacro",
    boundary = "sandbox-pre-execution",
    typeof = json_typeof(data),
    isArray = is_array,
    length = if (is_array) length(data) else if (is.character(data) && length(data) == 1) nchar(data, type = "chars") else NULL,
    topLevelKeys = if (is_record) unname(lapply(javascript_sort_keys(names(data)), redact_key)) else list(),
    setIsArray = set_is_array,
    setTypeof = set_typeof,
    setLength = if (set_is_array) length(set_value) else NULL,
    setLabels = set_labels,
    macro_id = if (is.character(item$macro_id) && length(item$macro_id) == 1) item$macro_id else NULL,
    workbook_version_id = if (is.character(item$workbook_version_id) && length(item$workbook_version_id) == 1) item$workbook_version_id else NULL
  )
}

# 4. EXECUTION LOOP
for (item in batch_items) {
  
  # A. Define Scope / Environment for this run
  run_env <- new.env(parent = sandbox_parent)
  
  # Block dangerous functions in the sandbox.
  blocked <- list(
    # System/process access
    system     = "system() is disabled",
    system2    = "system2() is disabled",
    # File operations
    file.create = "file operations are disabled",
    file.remove = "file operations are disabled",
    unlink      = "file operations are disabled",
    writeLines  = "file operations are disabled",
    readLines   = "file operations are disabled",
    file        = "file operations are disabled",
    # Library loading
    library = "library loading is disabled",
    require = "library loading is disabled",
    source  = "sourcing files is disabled",
    # Variable/environment introspection
    get        = "get() is disabled",
    mget       = "mget() is disabled",
    Sys.getenv = "Sys.getenv() is disabled",
    Sys.setenv = "Sys.setenv() is disabled",
    # Stdout (would corrupt JSON output)
    cat        = "cat() is disabled in macros",
    print      = "print() is disabled in macros",
    message    = "message() is disabled in macros",
    # Timing
    Sys.time  = "Sys.time() is disabled",
    Sys.sleep = "Sys.sleep() is disabled",
    proc.time = "proc.time() is disabled",
    Sys.Date  = "Sys.Date() is disabled",
    # Environment escape
    globalenv      = "globalenv() is disabled",
    parent.env     = "parent.env() is disabled",
    parent.frame   = "parent.frame() is disabled",
    sys.frame      = "sys.frame() is disabled",
    sys.call       = "sys.call() is disabled",
    baseenv        = "baseenv() is disabled",
    environment    = "environment() is disabled",
    as.environment = "as.environment() is disabled",
    new.env        = "new.env() is disabled",
    # Super-assignment escape
    makeActiveBinding = "makeActiveBinding() is disabled",
    delayedAssign     = "delayedAssign() is disabled",
    assign            = "assign() is disabled"
  )

  for (fn_name in names(blocked)) {
    msg <- blocked[[fn_name]]
    assign(fn_name, eval(bquote(function(...) stop(paste("Security:", .(msg))))), envir = run_env)
    lockBinding(fn_name, run_env)
  }

  # Block namespace-qualified access (e.g. base::system).
  # Many R functions internally use :: (e.g. lm -> stats::model.frame),
  # so we selectively block only functions on the blocklist.
  blocked_names <- names(blocked)
  real_get <- getExportedValue  # capture before blocking
  safe_ns <- function(pkg, name) {
    fn <- as.character(substitute(name))
    if (fn %in% blocked_names) {
      stop(paste0("Security: ", as.character(substitute(pkg)), "::", fn, "() is disabled"))
    }
    real_get(as.character(substitute(pkg)), fn)
  }
  safe_ns3 <- function(pkg, name) {
    fn <- as.character(substitute(name))
    if (fn %in% blocked_names) {
      stop(paste0("Security: ", as.character(substitute(pkg)), ":::", fn, "() is disabled"))
    }
    real_get(as.character(substitute(pkg)), fn)
  }
  assign("::", safe_ns, envir = run_env)
  lockBinding("::", run_env)
  assign(":::", safe_ns3, envir = run_env)
  lockBinding(":::", run_env)
  assign("getExportedValue", function(...) stop("Security: getExportedValue() is disabled"), envir = run_env)
  lockBinding("getExportedValue", run_env)
  assign("getFromNamespace", function(...) stop("Security: getFromNamespace() is disabled"), envir = run_env)
  lockBinding("getFromNamespace", run_env)
  assign("getNamespace", function(...) stop("Security: getNamespace() is disabled"), envir = run_env)
  lockBinding("getNamespace", run_env)
  assign("asNamespace", function(...) stop("Security: asNamespace() is disabled"), envir = run_env)
  lockBinding("asNamespace", run_env)
  assign("loadNamespace", function(...) stop("Security: loadNamespace() is disabled"), envir = run_env)
  lockBinding("loadNamespace", run_env)

  assign(".GlobalEnv", NULL, envir = run_env)
  lockBinding(".GlobalEnv", run_env)

  # Inject the host-normalized value unchanged, preserving every JSON root type.
  run_env$json <- item$data
  # Upstream cell outputs keyed by canonical name, read-only via a locked binding.
  # R copy-on-modify means nested reads are inherently isolated per item.
  run_env$ctx <- if (is.null(item$context)) list() else item$context
  lockBinding("ctx", run_env)
  # Use an environment (reference semantics) so output$key <- val works in-place.
  run_env$output <- new.env(parent = emptyenv())

  fingerprints[[length(fingerprints) + 1]] <- build_shape_fingerprint(item)
  
  # B. Run User Code
  execution_result <- if (!is.null(parse_error)) {
    list(
      id = item$id,
      success = FALSE,
      error = parse_error
    )
  } else {
    tryCatch({
    # 1s per-item timeout
    setTimeLimit(cpu = 1.0, elapsed = 1.0, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE))
    
    eval(parsed_code, envir = run_env)
    
    # Success
    # Convert output env back to a list for JSON.
    list(
      id = item$id,
      success = TRUE,
      output = as.list(run_env$output)
    )
  }, error = function(e) {
    list(
      id = item$id,
      success = FALSE,
      error = as.character(e$message)
    )
  })
  }
  
  results[[length(results) + 1]] <- execution_result
}

# 5. OUTPUT
# Use digits=NA to preserve full floating-point precision (max 17 significant digits)
json_output <- toJSON(
  list(status = "success", results = results, fingerprints = fingerprints),
  auto_unbox = TRUE,
  digits = NA,
  null = "null"
)

# If output file path provided (Lambda mode), write to file to avoid stdout corruption.
# Otherwise, write to stdout (for backward compatibility / testing).
if (!is.na(output_file_path) && nchar(output_file_path) > 0) {
  writeLines(json_output, output_file_path)
} else {
  cat(json_output)
}
