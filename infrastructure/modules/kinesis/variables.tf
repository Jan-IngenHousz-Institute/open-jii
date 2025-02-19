variable "stream_name" {
  description = "Name of the Kinesis Data Stream"
  type        = string
}

variable "shard_count" {
  description = "Number of shards for the stream"
  type        = number
  default     = 1
}

variable "retention_period_hours" {
  description = "Data retention period in hours"
  type        = number
  default     = 24
}
