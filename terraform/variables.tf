variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Base name of the project"
  type        = string
  default     = "my-static-site"
}

variable "environment_name" {
  description = "Environment name (e.g., main, pr-123)"
  type        = string
}

variable "force_destroy" {
  description = "Whether to force destroy the bucket (useful for ephemeral PR buckets)"
  type        = bool
  default     = false
}
