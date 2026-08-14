# cloudfront-errors

CloudFront 5xx error rate above threshold for the web distribution.

Likely causes: OpenNext server Lambda erroring (see opennext-lambda-errors); origin misconfig after infra change; Lambda throttling under burst.

First moves: split by behavior (server vs static vs image) in the Serving dashboard; check opennext-lambda-errors and Lambda logs; recent CloudFront config applies show in the tofu history.
