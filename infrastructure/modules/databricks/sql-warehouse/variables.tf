variable "name" {
  description = "The warehouse's display name"
  type        = string
}

variable "cluster_size" {
  description = "Size of each cluster, such as 2X-Small or X-Small"
  type        = string
  default     = "2X-Small"
}

variable "max_num_clusters" {
  description = "Clusters the warehouse may scale out to under concurrent load"
  type        = number
  default     = 1
}

variable "auto_stop_mins" {
  description = "Idle minutes before the warehouse stops. Serverless warehouses accept 1 through the API; the UI's minimum is 5."
  type        = number
  default     = 1
}

variable "can_use_groups" {
  description = "Groups granted CAN_USE. Leave empty on a warehouse imported with an access list of its own, since the grant replaces it."
  type        = list(string)
  default     = []
}
