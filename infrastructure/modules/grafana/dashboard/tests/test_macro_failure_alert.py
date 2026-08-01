import json
import re
import unittest
from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parents[1]
MAIN_TF = (MODULE_DIR / "main.tf").read_text(encoding="utf-8")
VARIABLES_TF = (MODULE_DIR / "variables.tf").read_text(encoding="utf-8")
PROD_MAIN_TF = (MODULE_DIR.parents[2] / "env" / "prod" / "main.tf").read_text(
    encoding="utf-8"
)


def metric_value(log_line: str) -> int | None:
    event = json.loads(log_line)
    if (
        event.get("context") == "ExecuteMacroBatchUseCase"
        and event.get("msg") == "Macro batch execution completed"
        and event.get("operation") == "executeMacroBatch"
        and isinstance(event.get("failureCount"), int)
    ):
        return event["failureCount"]
    return None


class MacroFailureAlertTest(unittest.TestCase):
    def test_metric_filter_selects_only_one_batch_completion_log(self) -> None:
        use_case_log = json.dumps(
            {
                "context": "ExecuteMacroBatchUseCase",
                "msg": "Macro batch execution completed",
                "operation": "executeMacroBatch",
                "failureCount": 7,
            }
        )
        controller_log = json.dumps(
            {
                "context": "MacroWebhookController",
                "msg": "Macro batch execution completed",
                "operation": "executeMacroBatch",
                "failureCount": 7,
            }
        )

        emitted = [
            value
            for line in (use_case_log, controller_log)
            if (value := metric_value(line)) is not None
        ]

        self.assertEqual(emitted, [7])
        self.assertIn('$.context = \\"ExecuteMacroBatchUseCase\\"', MAIN_TF)
        self.assertIn('$.failureCount = *', MAIN_TF)
        self.assertIn('value         = "$.failureCount"', MAIN_TF)

    def test_incident_shape_fires_but_normal_errors_do_not(self) -> None:
        threshold_match = re.search(
            r'variable "macro_batch_failure_threshold".*?default\s*=\s*(\d+)',
            VARIABLES_TF,
            re.DOTALL,
        )
        self.assertIsNotNone(threshold_match)
        threshold = int(threshold_match.group(1))

        cases = [
            ("29 July incident", [182, 0, 0, 0, 0], True),
            ("normal genuine errors", [1, 1, 1, 1, 1], False),
        ]

        for name, minute_failure_counts, should_fire in cases:
            with self.subTest(name=name):
                self.assertEqual(sum(minute_failure_counts) > threshold, should_fire)

    def test_alert_is_wired_only_when_explicitly_enabled(self) -> None:
        enable_variable = re.search(
            r'variable "enable_macro_failure_alert"\s*\{(.*?)\n\}',
            VARIABLES_TF,
            re.DOTALL,
        )
        self.assertIsNotNone(enable_variable)
        self.assertRegex(enable_variable.group(1), r"default\s*=\s*false")
        self.assertRegex(PROD_MAIN_TF, r"enable_macro_failure_alert\s*=\s*true")
        self.assertIn(
            'log_group_name     = "/aws/ecs/backend-service-${var.environment}"',
            PROD_MAIN_TF,
        )
        self.assertIn("log_group_name = var.ecs_log_group_name", MAIN_TF)
        self.assertIn('for_each = var.enable_macro_failure_alert ? [1] : []', MAIN_TF)
        self.assertIn('contact_point   = grafana_contact_point.slack.name', MAIN_TF)
        self.assertIn('service  = "macro-execution"', MAIN_TF)


if __name__ == "__main__":
    unittest.main()
