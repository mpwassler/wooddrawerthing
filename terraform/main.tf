resource "aws_s3_bucket" "website" {
  # Bucket names must be globally unique.
  # We construct it as: project-environment-randomsuffix (optional, but good for uniqueness)
  # or just project-environment if you control the namespace well.
  bucket = "${var.project_name}-${var.environment_name}"
  
  # Allow deletion of non-empty bucket for PR environments if force_destroy is true
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# Public Access Block - We need to TURN OFF "Block all public access" 
# to allow the bucket policy to grant public read access.
resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = false
  ignore_public_acls      = false
  block_public_policy     = false
  restrict_public_buckets = false
}

# Bucket Policy for Public Read Access
resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.website.arn}/*"
      },
    ]
  })
  
  depends_on = [aws_s3_bucket_public_access_block.website]
}
