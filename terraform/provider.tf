terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # We will use a partial configuration for the backend, 
  # filling in the key dynamically in GitHub Actions.
  backend "s3" {
    # You must replace these placeholders or pass them via -backend-config in CI
    # bucket = "YOUR_TERRAFORM_STATE_BUCKET"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "StaticSiteHosting"
      Environment = var.environment_name
      ManagedBy   = "Terraform"
    }
  }
}
