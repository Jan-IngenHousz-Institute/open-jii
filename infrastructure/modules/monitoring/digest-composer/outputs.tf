output "function_name" {
  description = "Name of the composer Lambda, so a rule watching it cannot drift from a misspelling"
  value       = aws_lambda_function.digest_composer.function_name
}
