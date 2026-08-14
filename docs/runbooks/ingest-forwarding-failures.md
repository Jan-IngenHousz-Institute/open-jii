# ingest-forwarding-failures

IoT Core accepted device messages but a topic rule action failed to deliver them to Kinesis or the S3 archive. Data loss risk: messages are not retried indefinitely.

Likely causes: IAM role for the rule action broken by an infra change; Kinesis throttling (see kinesis-write-throttling); S3 bucket policy drift; malformed rule SQL after asyncapi.yaml edits.

First moves: CloudWatch Logs `AWSIotLogsV2` filtered to RuleExecution errors; check which rule fails (per-channel rules are generated from asyncapi.yaml); verify the rule's IAM role and target. The S3 archive and Kinesis are independent actions, one can fail alone.
