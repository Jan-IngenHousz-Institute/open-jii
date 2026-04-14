# R helper functions for MultispeQ macro processing.

# Array manipulation functions

#' Extract every n-th element from a vector or list
#' @param arr Input vector or list
#' @param size Step size (default: 1)
#' @param idx Starting point (default: 0, 0-based indexing for consistency)
#' @return Every n-th element
#' @examples
#' ArrayNth(c(1, 2, 3, 4, 5, 6), 2, 2)  # returns c(3, 5)
ArrayNth <- function(arr, size = 1, idx = 0) {
  # Handle NULL or empty input
  if (is.null(arr) || length(arr) == 0) {
    return(NULL)
  }
  
  # Accept both vectors and lists
  if (!is.vector(arr) && !is.list(arr)) {
    return(NULL)
  }
  
  if (idx < 0) idx <- 0
  if (size < 1) size <- 1
  
  # Convert to 1-based indexing for R
  start_idx <- idx + 1
  indices <- seq(from = start_idx, to = length(arr), by = size)
  
  # Return as appropriate type
  if (is.list(arr)) {
    return(arr[indices])
  } else {
    return(arr[indices])
  }
}

#' Generate a vector of arithmetic progressions with optional transformations
#' @param start Start value (default: 0)
#' @param stop Stop value (required if start is provided)
#' @param step Step size (default: 1)
#' @param transform Transformation type ('none', 'log', 'ln', 'x2')
#' @return Vector of numbers with optional transformation applied
#' @examples
#' ArrayRange(10)  # returns 0:9
#' ArrayRange(1, 11)  # returns 1:10
#' ArrayRange(0, 10, 3, "x2")  # returns c(0, 9, 36, 81)
ArrayRange <- function(start = NULL, stop = NULL, step = 1, transform = "none") {
  if (is.null(start)) {
    return(numeric(0))
  }
  
  if (is.null(stop)) {
    stop <- start
    start <- 0
  }
  
  # Generate sequence
  result <- seq(from = start, to = stop - 1, by = step)
  
  # Apply transformation
  # Match JS/Python behavior: log of non-positive values produces NaN
  if (transform == "log") {
    result <- log10(result)
  } else if (transform == "ln") {
    result <- log(result)
  } else if (transform == "x2") {
    result <- result^2
  }
  
  return(result)
}

#' Unzip a list of paired vectors into separate vectors
#' @param input_data List of paired vectors
#' @return List with x and y components
ArrayUnZip <- function(input_data) {
  if (!is.list(input_data) || length(input_data) == 0) {
    return(list(x = numeric(0), y = numeric(0)))
  }
  
  # Extract x and y values
  x_values <- sapply(input_data, function(pair) {
    if (length(pair) >= 1) pair[1] else NA
  })
  
  y_values <- sapply(input_data, function(pair) {
    if (length(pair) >= 2) pair[2] else NA
  })
  
  return(list(x = x_values, y = y_values))
}

#' Zip two vectors into a list of paired vectors
#' @param x First vector
#' @param y Second vector
#' @return List of paired vectors
ArrayZip <- function(x, y) {
  if (!is.vector(x) || !is.vector(y)) {
    return(list())
  }
  
  min_length <- min(length(x), length(y))
  
  result <- list()
  for (i in seq_len(min_length)) {
    result[[i]] <- c(x[i], y[i])
  }
  return(result)
}

# Mathematical functions

#' Linear regression
#' @param x Independent variable vector
#' @param y Dependent variable vector
#' @return List with regression statistics
MathLINREG <- function(x, y) {
  if (!is.vector(x) || !is.vector(y) || length(x) != length(y) || length(x) < 2) {
    return(FALSE)
  }
  
  # Remove NA values
  complete_cases <- complete.cases(x, y)
  x <- x[complete_cases]
  y <- y[complete_cases]
  
  if (length(x) < 2) {
    return(FALSE)
  }
  
  if (var(x) == 0) {
    return(FALSE)
  }
  
  xn <- length(x)
  xSum <- sum(x)
  ySum <- sum(y)
  xxSum <- sum(x * x)
  xySum <- sum(x * y)
  yySum <- sum(y * y)
  
  m <- (xn * xySum - xSum * ySum) / (xn * xxSum - xSum * xSum)
  b <- (ySum - m * xSum) / xn
  r <- (xySum - (1 / xn) * xSum * ySum) /
    sqrt((xxSum - (1 / xn) * xSum^2) * (yySum - (1 / xn) * ySum^2))
  
  return(list(
    m = m,
    b = b,
    r = r,
    r2 = r * r
  ))
}

#' Natural logarithm
#' @param value Input value
#' @return Natural logarithm of value
MathLN <- function(value) {
  return(log(value))
}

#' Base-10 logarithm
#' @param value Input value
#' @return Base-10 logarithm of value
MathLOG <- function(value) {
  return(log10(value))
}

#' Maximum value
#' @param values Vector of values
#' @return Maximum value
MathMAX <- function(values) {
  # Handle NULL
  if (is.null(values)) {
    return(NA)
  }
  
  # Convert list to vector if necessary
  if (is.list(values) && !is.data.frame(values)) {
    values <- unlist(values)
  }
  
  # Check if empty or not numeric
  if (length(values) == 0 || !is.numeric(values)) {
    return(NA)
  }
  
  return(max(values, na.rm = TRUE))
}

#' Mean (average) value
#' @param values Vector of values
#' @return Mean value
MathMEAN <- function(values) {
  # Handle NULL
  if (is.null(values)) {
    return(NA)
  }
  
  # Convert list to vector if necessary
  if (is.list(values) && !is.data.frame(values)) {
    values <- unlist(values)
  }
  
  # Check if empty or not numeric
  if (length(values) == 0 || !is.numeric(values)) {
    return(NA)
  }
  
  return(mean(values, na.rm = TRUE))
}

#' Median value
#' @param values Vector of values
#' @return Median value
MathMEDIAN <- function(values) {
  if (!is.vector(values) || length(values) == 0) {
    return(NA)
  }
  return(median(values, na.rm = TRUE))
}

#' Minimum value
#' @param values Vector of values
#' @return Minimum value
MathMIN <- function(values) {
  # Handle NULL
  if (is.null(values)) {
    return(NA)
  }
  
  # Convert list to vector if necessary
  if (is.list(values) && !is.data.frame(values)) {
    values <- unlist(values)
  }
  
  # Check if empty or not numeric
  if (length(values) == 0 || !is.numeric(values)) {
    return(NA)
  }
  
  return(min(values, na.rm = TRUE))
}

#' Round to specified decimal places
#' @param value Input value
#' @param digits Number of decimal places (default: 2)
#' @return Rounded value
MathROUND <- function(value, digits = 2) {
  return(round(value, digits))
}

#' Standard error
#' @param values Vector of values
#' @return Standard error
MathSTDERR <- function(values) {
  if (!is.vector(values) || length(values) < 2) {
    return(NA)
  }
  values <- values[!is.na(values)]
  if (length(values) < 2) {
    return(NA)
  }
  return(sd(values) / sqrt(length(values)))
}

#' Population standard deviation
#' @param values Vector of values
#' @return Population standard deviation
MathSTDEV <- function(values) {
  if (!is.vector(values) || length(values) < 2) {
    return(NA)
  }
  values <- values[!is.na(values)]
  if (length(values) < 2) {
    return(NA)
  }
  # Population standard deviation
  n <- length(values)
  return(sqrt(sum((values - mean(values))^2) / n))
}

#' Sample standard deviation
#' @param values Vector of values
#' @return Sample standard deviation
MathSTDEVS <- function(values) {
  if (!is.vector(values) || length(values) < 2) {
    return(NA)
  }
  return(sd(values, na.rm = TRUE))
}

#' Sum of values
#' @param values Vector of values
#' @return Sum of values
MathSUM <- function(values) {
  if (!is.vector(values) || length(values) == 0) {
    return(NA)
  }
  return(sum(values, na.rm = TRUE))
}

#' Variance
#' @param values Vector of values
#' @return Variance
MathVARIANCE <- function(values) {
  if (!is.vector(values) || length(values) < 2) {
    return(NA)
  }
  return(var(values, na.rm = TRUE))
}

# Protocol and data access functions

#' Get index by label from JSON data
#' @param label Label to search for
#' @param json_data JSON data object (list)
#' @param array Whether to return array of indices
#' @return Index or indices of matching labels
GetIndexByLabel <- function(label, json_data, array = FALSE) {
  if (is.null(label) || !is.list(json_data) || !"set" %in% names(json_data)) {
    return(if (array) integer(0) else NA)
  }
  
  # Find all matching indices (0-based for consistency with JS)
  indices <- c()
  for (i in seq_along(json_data$set)) {
    protocol <- json_data$set[[i]]
    if (is.list(protocol) && "label" %in% names(protocol) && protocol$label == label) {
      indices <- c(indices, i - 1)  # Convert to 0-based indexing
    }
  }
  
  if (length(indices) == 0) {
    return(if (array) integer(0) else NA)
  } else if (length(indices) == 1 && !array) {
    return(indices[1])
  } else {
    return(indices)
  }
}

#' Generate a protocol lookup table for a protocol set
#' @param json_data JSON data object (list)
#' @return Lookup table
#' @examples
#' GetLabelLookup(json_data)
#' # returns e.g. list("PAM" = c(0,2), "ECS" = c(1))
GetLabelLookup <- function(json_data) {
  lookup <- list()
  
  # Return NULL if there is no set
  if (!is.list(json_data) || !"set" %in% names(json_data)) {
    return(NULL)
  }
  
  for (i in seq_along(json_data$set)) {
    protocol <- json_data$set[[i]]
    if (is.list(protocol) && "label" %in% names(protocol)) {
      label <- protocol$label
      if (is.null(lookup[[label]])) {
        lookup[[label]] <- c()
      }
      # Use 0-based indexing for consistency with JS
      lookup[[label]] <- c(lookup[[label]], i - 1)
    }
  }
  
  if (length(lookup) == 0) {
    return(NULL)
  } else {
    return(lookup)
  }
}

#' Get protocol by label
#' @param label Label to search for
#' @param json_data JSON data object (list)
#' @param array Whether to return array of protocols
#' @return Protocol or protocols matching label
GetProtocolByLabel <- function(label, json_data, array = FALSE) {
  if (is.null(label) || !is.list(json_data) || !"set" %in% names(json_data)) {
    return(if (array) list() else NULL)
  }
  
  # Filter protocols by label
  matching_protocols <- list()
  for (protocol in json_data$set) {
    if (is.list(protocol) && "label" %in% names(protocol) && protocol$label == label) {
      matching_protocols <- append(matching_protocols, list(protocol))
    }
  }
  
  if (length(matching_protocols) == 0) {
    return(if (array) list() else NULL)
  } else if (length(matching_protocols) == 1 && !array) {
    return(matching_protocols[[1]])
  } else {
    return(matching_protocols)
  }
}

# Messaging functions for macro output
# Format: output$messages = list(info = c(...), warning = c(...), danger = c(...))
# Matches the JS/Python message shape: { messages: { info: [], warning: [], danger: [] } }

#' Add info message to output
#' @param msg Message text
#' @param output Output list to modify
#' @return Modified output list
info <- function(msg, output) {
  if (!is.list(output)) {
    output <- list()
  }
  
  if (!"messages" %in% names(output)) {
    output$messages <- list()
  }
  
  if (!"info" %in% names(output$messages)) {
    output$messages$info <- c()
  }
  
  output$messages$info <- c(output$messages$info, msg)
  
  return(output)
}

#' Add warning message to output
#' @param msg Message text
#' @param output Output list to modify
#' @return Modified output list
warning <- function(msg, output) {
  if (!is.list(output)) {
    output <- list()
  }
  
  if (!"messages" %in% names(output)) {
    output$messages <- list()
  }
  
  if (!"warning" %in% names(output$messages)) {
    output$messages$warning <- c()
  }
  
  output$messages$warning <- c(output$messages$warning, msg)
  
  return(output)
}

#' Add danger/error message to output
#' @param msg Message text
#' @param output Output list to modify
#' @return Modified output list
danger <- function(msg, output) {
  if (!is.list(output)) {
    output <- list()
  }
  
  if (!"messages" %in% names(output)) {
    output$messages <- list()
  }
  
  if (!"danger" %in% names(output$messages)) {
    output$messages$danger <- c()
  }
  
  output$messages$danger <- c(output$messages$danger, msg)
  
  return(output)
}

#' Non-linear regression (simplified version)
#' @param data Matrix of [x,y] pairs
#' @param options List with equation, initial parameters, etc.
#' @return List with regression results
NonLinearRegression <- function(data, options) {
  # This is a simplified implementation of the complex JS NonLinearRegression
  if (!is.matrix(data) && !is.data.frame(data)) {
    return(list(text = "Error: Invalid data", r2 = NA, parameters = list(), RMS_error = NA))
  }
  
  if (ncol(data) < 2 || nrow(data) < 3) {
    return(list(text = "Error: Insufficient data", r2 = NA, parameters = list(), RMS_error = NA))
  }
  
  if (!is.list(options) || !"equation" %in% names(options) || !"initial" %in% names(options)) {
    return(list(text = "Error: Missing equation or initial parameters", r2 = NA, parameters = list(), RMS_error = NA))
  }
  
  x <- data[, 1]
  y <- data[, 2]
  
  # Basic exponential decay: y = a + b * exp(-x/c)
  if (grepl("exp.*-.*x", options$equation)) {
    if (length(options$initial) < 3) {
      return(list(text = "Error: Need 3 initial parameters for exponential", r2 = NA, parameters = list(), RMS_error = NA))
    }
    
    tryCatch({
      model <- nls(y ~ a + b * exp(-x/c), 
                   start = list(a = options$initial[1], 
                               b = options$initial[2], 
                               c = options$initial[3]))
      
      coeffs <- coef(model)
      fitted_vals <- fitted(model)
      
      # Calculate R-squared
      ss_res <- sum((y - fitted_vals)^2)
      ss_tot <- sum((y - mean(y))^2)
      r2 <- 1 - (ss_res / ss_tot)
      
      rms_error <- sqrt(mean((y - fitted_vals)^2))
      
      return(list(
        text = "Exponential decay fit completed",
        r2 = r2,
        parameters = list(
          list(name = "a", value = coeffs[1]),
          list(name = "b", value = coeffs[2]),
          list(name = "c", value = coeffs[3])
        ),
        RMS_error = rms_error
      ))
    }, error = function(e) {
      return(list(text = paste("Fitting error:", e$message), r2 = NA, parameters = list(), RMS_error = NA))
    })
  } else {
    return(list(text = "Equation not supported in R implementation", r2 = NA, parameters = list(), RMS_error = NA))
  }
}

# Advanced mathematical functions (simplified versions)

#' Multiple regression
#' @param input_raw Matrix of input data where columns are [predictor1, predictor2, ..., response]
#' @return List with regression results
MathMULTREG <- function(input_raw) {
  if (!is.matrix(input_raw) && !is.data.frame(input_raw)) {
    return(list(rsquared = NA, slopes = numeric(0), points = list()))
  }
  
  if (ncol(input_raw) < 2 || nrow(input_raw) < 2) {
    return(list(rsquared = NA, slopes = numeric(0), points = list()))
  }
  
  # Extract predictors and response
  num_predictors <- ncol(input_raw) - 1
  predictors <- as.matrix(input_raw[, 1:num_predictors, drop = FALSE])
  response <- input_raw[, ncol(input_raw)]
  
  # Remove rows with NA values
  complete_cases <- complete.cases(predictors, response)
  predictors <- predictors[complete_cases, , drop = FALSE]
  response <- response[complete_cases]
  
  if (length(response) < 2) {
    return(list(rsquared = NA, slopes = numeric(0), points = list()))
  }
  
  # Perform multiple regression
  model <- lm(response ~ predictors)
  
  # Calculate R-squared
  r_squared <- summary(model)$r.squared
  
  # Get coefficients (intercept and slopes)
  coefficients <- as.numeric(coef(model))
  
  # Calculate fitted values
  y_hat <- fitted(model)
  
  return(list(
    rsquared = r_squared,
    slopes = coefficients,
    points = list(predictors, y_hat)
  ))
}

#' Polynomial regression
#' @param input_raw Matrix of input data
#' @param degree Polynomial degree
#' @return List with regression results
MathPOLYREG <- function(input_raw, degree) {
  if (!is.matrix(input_raw) && !is.data.frame(input_raw)) {
    return(NULL)
  }
  
  if (ncol(input_raw) < 2 || nrow(input_raw) < degree + 1) {
    return(NULL)
  }
  
  # Build transformed matrix like JS: [x^1, x^2, ..., x^degree, y]
  transformed <- matrix(0, nrow = nrow(input_raw), ncol = degree + 1)
  for (j in 1:degree) {
    transformed[, j] <- input_raw[, 1]^j
  }
  transformed[, degree + 1] <- input_raw[, 2]
  
  polyReg <- MathMULTREG(transformed)
  slopes <- polyReg$slopes
  
  # Calculate fitted points and error
  points <- list()
  yError <- 0
  for (i in 1:nrow(input_raw)) {
    yHat <- 0
    for (j in 0:degree) {
      yHat <- yHat + input_raw[i, 1]^j * slopes[j + 1]
    }
    points[[i]] <- c(input_raw[i, 1], yHat)
    yError <- yError + (yHat - input_raw[i, 2])^2
  }
  yError <- yError / (nrow(input_raw) - 1)
  
  return(list(
    points = points,
    slopes = slopes,
    error = yError
  ))
}

#' Exponential inverse regression (Y = Y0 + A*e^(-x/t))
#' @param input_raw Matrix of input data [predictor, response]
#' @return List with regression results
MathEXPINVREG <- function(input_raw) {
  if (!is.matrix(input_raw) && !is.data.frame(input_raw)) {
    return(NULL)
  }
  
  if (ncol(input_raw) < 2 || nrow(input_raw) < 4) {
    return(NULL)
  }
  
  y <- input_raw[, 2]
  
  # Trapezoidal Riemann sum (matches JS algorithm)
  riemann <- 0
  riemannSq <- 0
  for (i in 1:(length(y) - 1)) {
    tmp <- (y[i] + y[i + 1]) / 2
    riemann <- riemann + tmp
    tmp <- (y[i]^2 + y[i + 1]^2) / 2
    riemannSq <- riemannSq + tmp
  }
  
  asymptote <- (riemannSq - (riemann * (y[1] + y[length(y)])) / 2) /
    (riemann - (length(y) * (y[1] + y[length(y)])) / 2)
  
  # Transform: ln(Y - asymptote)
  input_transformed <- input_raw
  for (i in 1:nrow(input_raw)) {
    tmp <- input_raw[i, 2] - asymptote
    if (tmp < 0) tmp <- -tmp
    input_transformed[i, 2] <- log(tmp)
  }
  
  constants <- c(0.5)
  t2 <- 50
  t2_old <- NA
  t_val <- NA
  A <- NA
  linReg <- NULL
  
  for (iter in 1:10) {
    if (t2 < 2) {
      t_val <- -999999
      A <- 0
      break
    }
    
    t2_old <- t2
    end_idx <- min(t2, nrow(input_transformed))
    linReg <- MathMULTREG(input_transformed[1:end_idx, , drop = FALSE])
    
    t2 <- round((-1 / linReg$slopes[2]) * constants[1])
    if (iter == 10) {
      t2 <- if (t2 > t2_old) t2 else t2_old
      end_idx <- min(t2, nrow(input_transformed))
      linReg <- MathMULTREG(input_transformed[1:end_idx, , drop = FALSE])
    }
    
    t_val <- linReg$slopes[2]
    A <- exp(linReg$slopes[1])
  }
  
  # Calculate fitted points
  points <- list()
  for (i in 1:nrow(input_raw)) {
    points[[i]] <- c(input_raw[i, 1], A * exp(input_raw[i, 1] * t_val) + asymptote)
  }
  
  # Calculate error
  yError <- 0
  for (i in 1:nrow(input_raw)) {
    yError <- yError + (A * exp(input_raw[i, 1] * t_val) - input_raw[i, 2] + asymptote)^2
  }
  yError <- yError / (nrow(input_raw) - 1)
  
  lifetime <- -1 / t_val
  slope <- -1 * A * t_val
  
  return(list(
    points = points,
    results = c(A, t_val),
    error = yError,
    asymptote = asymptote,
    rsquared = if (!is.null(linReg)) linReg$rsquared else NA,
    lifetime = lifetime,
    slope = slope
  ))
}

#' Transform trace data
#' @param fn Transformation function name
#' @param a1 First array
#' @param a2 Second array or scalar (optional)
#' @return Transformed array
TransformTrace <- function(fn, a1, a2 = NULL) {
  if (!is.vector(a1)) {
    return(numeric(0))
  }
  
  switch(fn,
    # Basic arithmetic
    "add" = , "+" = if (is.null(a2)) a1 else a1 + a2,
    "subtract" = , "-" = if (is.null(a2)) a1 else a1 - a2,
    "multiply" = , "*" = if (is.null(a2)) a1 else a1 * a2,
    "divide" = , "/" = if (is.null(a2)) a1 else a1 / a2,
    
    # Normalization functions
    "normToMin" = {
      min_val <- min(a1, na.rm = TRUE)
      a1 / min_val
    },
    "normToMax" = {
      max_val <- max(a1, na.rm = TRUE)
      a1 / max_val
    },
    "normToRange" = {
      min_val <- min(a1, na.rm = TRUE)
      max_val <- max(a1, na.rm = TRUE)
      (a1 - min_val) / (max_val - min_val)
    },
    "normToIdx" = {
      if (is.null(a2)) return(a1)
      idx <- as.integer(a2) + 1  # Convert to 1-based indexing
      if (idx > 0 && idx <= length(a1)) {
        a1 / a1[idx]
      } else {
        a1
      }
    },
    "normToVal" = {
      if (is.null(a2) || a2 == 0) return(a1)
      a1 / a2
    },
    
    # Smoothing functions
    "ma" = {
      # Moving average (window 3) with end-padding to match JS
      n <- length(a1)
      if (n < 3) return(a1)
      # Pad one element on each side
      padded <- c(a1[1], a1, a1[n])
      result <- numeric(n)
      for (i in 1:n) {
        result[i] <- (padded[i] + padded[i + 1] + padded[i + 2]) / 3
      }
      result
    },
    "sgf" = {
      # 7-point Savitzky-Golay filter with 3-element end-padding to match JS
      n <- length(a1)
      if (n < 7) return(a1)
      # Pad 3 elements on each side
      padded <- c(a1[3], a1[2], a1[1], a1, a1[n], a1[n - 1], a1[n - 2])
      result <- numeric(n)
      for (i in 1:n) {
        j <- i + 3  # offset into padded array
        result[i] <- (-2 * padded[j - 3] +
                       3 * padded[j - 2] +
                       6 * padded[j - 1] +
                       7 * padded[j] +
                       6 * padded[j + 1] +
                       3 * padded[j + 2] +
                      -2 * padded[j + 3]) / 21
      }
      result
    },
    
    # Absorbance calculation -log(I/I0)
    "abs" = {
      if (is.null(a2)) {
        # Use first value as I0
        i0 <- a1[1]
      } else {
        i0 <- a2
      }
      if (i0 <= 0) return(rep(NA, length(a1)))
      -log10(a1 / i0)
    },
    
    # Mathematical functions
    "sqrt" = sqrt(a1),
    "log" = log(a1),
    "log10" = log10(a1),
    "exp" = exp(a1),
    "sin" = sin(a1),
    "cos" = cos(a1),
    "tan" = tan(a1),
    
    # Default: return unchanged
    a1
  )
}
