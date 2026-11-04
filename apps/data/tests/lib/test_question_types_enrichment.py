import hashlib
import hmac
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import MagicMock

import pytest
from enrich.question_types import add_numeric_question_keys
from openjii.number_answers import typed_question_answers
from pyspark.sql import functions as F


@pytest.mark.spark
def test_real_arrow_batch_uses_approved_ledger_for_old_payloads(spark):
    active = "f1630d63-0d73-4f4d-8072-3f4acdef06e7"
    inactive = "44c5eaaf-2b91-41c0-89e9-94a4faafaa3e"
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            expected = hmac.new(
                b"fixture-secret",
                self.headers["x-databricks-timestamp"].encode() + b":" + body,
                hashlib.sha256,
            ).hexdigest()
            assert self.headers["x-databricks-signature"] == expected
            assert self.path == "/api/v1/experiments/question-types"
            payload = json.loads(body)
            requests.extend(payload["experimentIds"])
            response = {
                "success": True,
                "experiments": [
                    {"experimentId": value, "numericKeys": ["height"] if value == active else []}
                    for value in payload["experimentIds"]
                ],
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    secrets = {
        "webhook_base_url": f"http://127.0.0.1:{server.server_port}",
        "webhook_api_key_id": "fixture-key",
        "webhook_secret": "fixture-secret",
    }
    dbutils = MagicMock()
    dbutils.secrets.get.side_effect = lambda *, scope, key: secrets[key]
    try:
        frame = spark.createDataFrame(
            [
                (active, [1], '{"height":"12.50","plot":"007"}'),
                (inactive, [1], '{"height":"12.50"}'),
                (active, [], None),
            ],
            "experiment_id STRING, questions ARRAY<INT>, json STRING",
        )
        enriched = add_numeric_question_keys(frame, "fixture", dbutils).withColumn(
            "questions_data", F.parse_json("json")
        )
        converted = enriched.withColumn(
            "typed", typed_question_answers("questions_data", "_numeric_question_keys")
        )
        rows = converted.select("experiment_id", F.to_json("typed").alias("json")).collect()
        assert json.loads(rows[0].json) == {"height": 12.5, "plot": "007"}
        assert json.loads(rows[1].json) == {"height": "12.50"}
        assert rows[2].json is None
        assert set(requests) == {active, inactive}
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
