# AWS Location Service Place Index for search and geocoding
resource "aws_location_place_index" "main" {
  index_name  = var.place_index_name
  data_source = var.data_source
  description = var.description

  # Data source configuration
  data_source_configuration {
    intended_use = var.intended_use
  }

  tags = var.tags
}

# IAM policy for Location Service access
data "aws_iam_policy_document" "location_service_policy" {
  statement {
    sid    = "LocationServicePlaceIndexAccess"
    effect = "Allow"

    actions = [
      "geo:SearchPlaceIndexForPosition",
      "geo:SearchPlaceIndexForSuggestions",
      "geo:SearchPlaceIndexForText",
      "geo:GetPlace"
    ]

    resources = [
      aws_location_place_index.main.index_arn
    ]
  }
}

# IAM policy resource
resource "aws_iam_policy" "location_service_policy" {
  name        = var.iam_policy_name
  description = "Policy for accessing AWS Location Service Place Index"
  policy      = data.aws_iam_policy_document.location_service_policy.json

  tags = var.tags
}