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
  cat(toJSON(list(status = "error", results = list(), errors = list(paste0("Helpers file not found at: ", helpers_path))), auto_unbox = TRUE))
  quit(status = 0)
}
# Create an isolated parent env for sandbox scopes.
# Macros get standard R functions (sd, lm, optim, ...) but can't
# see the wrapper's own variables.
sandbox_parent <- new.env(parent = parent.env(globalenv()))
source(helpers_path, local = sandbox_parent)
lockEnvironment(sandbox_parent)

# 2. READ INPUT BATCH
if (!file.exists(input_data_path)) {
  cat(toJSON(list(status = "error", results = list(), errors = list("Input file not found")), auto_unbox = TRUE))
  quit(status = 0)
}

# Read JSON batch
batch_items <- fromJSON(input_data_path, simplifyVector = FALSE)
# Result list
results <- list()

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

  # Inject Data
  run_env$json <- item$data
  # Use an environment (reference semantics) so output$key <- val works in-place.
  run_env$output <- new.env(parent = emptyenv())
  
  # B. Run User Code
  execution_result <- tryCatch({
    # 1s per-item timeout
    setTimeLimit(cpu = 1.0, elapsed = 1.0, transient = TRUE)
    on.exit(setTimeLimit(cpu = Inf, elapsed = Inf, transient = FALSE))
    
    eval(parse(text = wrapped_code), envir = run_env)
    
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
  
  results[[length(results) + 1]] <- execution_result
}

# 5. OUTPUT
# Use digits=NA to preserve full floating-point precision (max 17 significant digits)
json_output <- toJSON(list(status = "success", results = results), auto_unbox = TRUE, digits = NA)

# If output file path provided (Lambda mode), write to file to avoid stdout corruption.
# Otherwise, write to stdout (for backward compatibility / testing).
if (!is.na(output_file_path) && nchar(output_file_path) > 0) {
  writeLines(json_output, output_file_path)
} else {
  cat(json_output)
}
