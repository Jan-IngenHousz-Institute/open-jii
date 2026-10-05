# ☁️ OpenNext CloudFront Module

This module creates the CloudFront distribution in front of an OpenNext deployment of the web app.

## 📖 Overview

One distribution serves the static assets from S3, the server-rendered pages and the API from the
server Lambda, optimized images from the image Lambda, and PostHog's capture traffic through a
reverse proxy. Behaviors are matched in the order below; the first path pattern that fits wins.

| Order | Path pattern                                                                 | Origin         | Cache policy                                   | Functions                               |
| ----- | ---------------------------------------------------------------------------- | -------------- | ---------------------------------------------- | --------------------------------------- |
| 1     | `/_next/static/*`                                                            | S3 assets      | Managed CachingOptimizedForUncompressedObjects | none                                    |
| 2     | `/_next/image`                                                               | Image Lambda   | `image_cache_policy`                           | none                                    |
| 3     | `/ingest/static/*`                                                           | PostHog assets | Managed CachingOptimizedForUncompressedObjects | `posthog_rewrite` (viewer request)      |
| 4     | `/ingest/*`                                                                  | PostHog ingest | Managed CachingDisabled                        | `posthog_rewrite` (viewer request)      |
| 5     | `api/*`                                                                      | Server Lambda  | Managed CachingDisabled                        | `forward_host_header`, `edge_hash_body` |
| 6     | `_next/data/*`                                                               | Server Lambda  | Managed CachingDisabled                        | `forward_host_header`                   |
| 7, 8  | `*.svg`, `*.ico`                                                             | S3 assets      | Managed CachingOptimizedForUncompressedObjects | none                                    |
| 9+    | `/*/platform*`, `/*/login*`, `/*/register*`, `/*/verify-request*`, `/de-DE*` | Server Lambda  | Managed CachingDisabled                        | `forward_host_header`, `edge_hash_body` |
| last  | default (`*`)                                                                | Server Lambda  | `server_pages`                                 | `forward_host_header`, `edge_hash_body` |

- `forward_host_header` is a CloudFront Function on viewer request. It redirects `www.` hosts to
  the bare host and copies `host` into `x-forwarded-host`, which the origins route on.
- `edge_hash_body` is a Lambda@Edge function on origin request. It adds `x-amz-content-sha256` to
  bodied requests, so the Lambda function URL accepts them under origin access control.

## 🗄 Page caching

The default behavior uses `server_pages`, a cache policy that lets the origin's `Cache-Control`
decide. Next marks static and ISR pages `s-maxage=…` and every page that reads the request
`private, no-cache, no-store`, so only pages that are the same for every visitor are ever stored.
A response with no `Cache-Control`, such as a proxy redirect, is not kept (`default_ttl = 0`).

What the cache key holds, and why:

- **`rsc` and the `next-router-*` headers, `next-url`**: Next answers an RSC payload and the
  HTML at the same URL and varies on these headers.
- **all query strings**: they carry `_rsc`.
- **`x-forwarded-host`**: set by `forward_host_header` before the lookup.
- **`x-prerender-revalidate`**: OpenNext regenerates a stale page by sending a request through
  CloudFront with this header; without it in the key, that request would be answered from cache
  and the page would never refresh.
- **the `__prerender_bypass` cookie only**: a Contentful preview request misses the shared copy.
  The session cookie stays out of the key. It is still forwarded to the origin by the origin
  request policy.

The CachingDisabled page behaviors (9+) are defence in depth for pages that differ per visitor.
Every locale except the default is listed too: `proxy.ts` decides per viewer who may see another
locale, and it can only decide for a request that reaches the origin. Add a locale's pattern here
when the web app adds one.

Origin errors (500, 502, 503 and 504) are never cached (`error_caching_min_ttl = 0`).

## 🛠 Resources Used

| Resource                               | Description                                                          |
| -------------------------------------- | -------------------------------------------------------------------- |
| `aws_cloudfront_distribution`          | The distribution, its origins and behaviors                          |
| `aws_cloudfront_cache_policy`          | `server_pages` for pages and `image_cache_policy` for `/_next/image` |
| `aws_cloudfront_origin_request_policy` | `posthog_passthrough` for the PostHog ingest origin                  |
| `aws_cloudfront_origin_access_control` | Signed access to the S3 bucket and the Lambda function URLs          |
| `aws_cloudfront_function`              | `forward_host_header` and `posthog_rewrite`                          |
| `aws_lambda_function`                  | `edge_hash_body`, the Lambda@Edge body hasher                        |

## ⚙️ Usage

```hcl
module "opennext_cloudfront" {
  source = "./opennext-cloudfront"

  project_name               = "my-nextjs-app"
  assets_bucket_name         = "my-app-assets"
  assets_bucket_domain_name  = "my-app-assets.s3.amazonaws.com"
  server_function_url_domain = "abcd1234.lambda-url.eu-central-1.on.aws"
  image_function_url_domain  = "efgh5678.lambda-url.eu-central-1.on.aws"

  aliases             = ["app.example.com"]
  acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
}
```

## 🔑 Inputs

| Name                         | Description                                          | Type           | Default            | Required |
| ---------------------------- | ---------------------------------------------------- | -------------- | ------------------ | :------: |
| `project_name`               | Name of the project, used for resource naming        | `string`       | n/a                |   Yes    |
| `assets_bucket_name`         | Name of the S3 assets bucket                         | `string`       | n/a                |   Yes    |
| `assets_bucket_domain_name`  | Domain name of the S3 assets bucket                  | `string`       | n/a                |   Yes    |
| `server_function_url_domain` | Domain of the server Lambda function URL             | `string`       | n/a                |   Yes    |
| `image_function_url_domain`  | Domain of the image optimization Lambda function URL | `string`       | n/a                |   Yes    |
| `aliases`                    | Custom domain aliases                                | `list(string)` | `[]`               |    No    |
| `acm_certificate_arn`        | ACM certificate for the custom domain                | `string`       | `null`             |    No    |
| `price_class`                | CloudFront price class                               | `string`       | `"PriceClass_100"` |    No    |
| `waf_acl_id`                 | WAFv2 ACL to associate with the distribution         | `string`       | `""`               |    No    |
| `enable_logging`             | Enable CloudFront access logging                     | `bool`         | `false`            |    No    |
| `log_bucket`                 | S3 bucket for the access logs                        | `string`       | `""`               |    No    |
| `tags`                       | Tags to apply to resources                           | `map(string)`  | `{}`               |    No    |

## 📤 Outputs

| Name                          | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `distribution_id`             | ID of the CloudFront distribution             |
| `distribution_arn`            | ARN of the CloudFront distribution            |
| `distribution_domain_name`    | Domain name of the CloudFront distribution    |
| `distribution_hosted_zone_id` | Hosted zone ID of the CloudFront distribution |
| `origin_access_control_id`    | ID of the S3 origin access control            |
