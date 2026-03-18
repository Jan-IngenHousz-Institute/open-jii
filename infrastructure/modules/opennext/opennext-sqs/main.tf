# Dead Letter Queue (optional)
resource "aws_sqs_queue" "dlq" {
  count                       = var.create_dlq ? 1 : 0
  name                        = "${var.queue_name}-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = var.message_retention_seconds
  tags                        = var.tags
}

# Main FIFO Queue
resource "aws_sqs_queue" "revalidation" {
  name                        = "${var.queue_name}.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  visibility_timeout_seconds  = var.visibility_timeout_seconds
  message_retention_seconds   = var.message_retention_seconds
  tags                        = var.tags

  redrive_policy = var.create_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null
}

# Event source mapping to trigger Lambda from SQS
resource "aws_lambda_event_source_mapping" "revalidation_trigger" {
  event_source_arn = aws_sqs_queue.revalidation.arn
  function_name    = var.revalidation_function_arn
  batch_size       = 1
  enabled          = true

  depends_on = [aws_sqs_queue.revalidation]
}
