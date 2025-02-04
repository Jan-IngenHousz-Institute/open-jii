module "infrastructure" {
  source = "../../"

}

module "s3_uploads" {
  source            = "../../modules/s3"
  bucket_name       = "jii-test-bucket-dev"
  enable_versioning = true
  sse_algorithm     = "AES256"
}
  