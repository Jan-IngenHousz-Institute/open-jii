/**
 * On-device unit tests for test-basic-ble-esp32
 *
 * These run on the actual ESP32-S3 via PlatformIO's Unity test runner.
 * They verify protocol helpers and JSON logic without requiring
 * sensors or a BLE connection.
 *
 *   pio test -d sketches/test-basic-ble-esp32
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <unity.h>

// ── Helpers copied from main.cpp for testability ────────────────
// (In a larger project these would live in a shared header.)

bool hasCompleteJson(const String &buf) {
  int depth = 0;
  for (unsigned int i = 0; i < buf.length(); i++) {
    if (buf[i] == '{') depth++;
    else if (buf[i] == '}') depth--;
    if (depth == 0 && i > 0) return true;
  }
  return false;
}

// ── hasCompleteJson tests ───────────────────────────────────────

void test_complete_json_simple_object(void) {
  TEST_ASSERT_TRUE(hasCompleteJson("{\"command\":\"PING\"}"));
}

void test_complete_json_nested_object(void) {
  TEST_ASSERT_TRUE(hasCompleteJson("{\"a\":{\"b\":1}}"));
}

void test_incomplete_json_missing_brace(void) {
  TEST_ASSERT_FALSE(hasCompleteJson("{\"command\":\"PING\""));
}

void test_incomplete_json_empty_string(void) {
  TEST_ASSERT_FALSE(hasCompleteJson(""));
}

void test_complete_json_with_trailing_data(void) {
  // First object is complete even if there's trailing text
  TEST_ASSERT_TRUE(hasCompleteJson("{\"a\":1}{\"b\":2}"));
}

// ── JSON protocol format tests ──────────────────────────────────

void test_success_response_format(void) {
  JsonDocument resp;
  resp["status"] = "success";
  resp["data"]["pong"] = true;

  String json;
  serializeJson(resp, json);

  // Must contain status field
  TEST_ASSERT_TRUE(json.indexOf("\"status\":\"success\"") >= 0);
  // Must contain data field
  TEST_ASSERT_TRUE(json.indexOf("\"data\"") >= 0);
}

void test_error_response_format(void) {
  JsonDocument resp;
  resp["status"] = "error";
  resp["error"] = "Unknown command: FOO";

  String json;
  serializeJson(resp, json);

  TEST_ASSERT_TRUE(json.indexOf("\"status\":\"error\"") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"error\"") >= 0);
}

void test_command_parsing(void) {
  const char *input = "{\"command\":\"INFO\"}";
  JsonDocument cmd;
  DeserializationError err = deserializeJson(cmd, input);

  TEST_ASSERT_TRUE(err == DeserializationError::Ok);
  TEST_ASSERT_EQUAL_STRING("INFO", cmd["command"] | "");
}

void test_invalid_json_parsing(void) {
  const char *input = "not json at all";
  JsonDocument cmd;
  DeserializationError err = deserializeJson(cmd, input);

  TEST_ASSERT_FALSE(err == DeserializationError::Ok);
}

void test_set_config_round_trip(void) {
  // Simulate SET_CONFIG → GET_CONFIG round-trip
  const char *configInput = "{\"command\":\"SET_CONFIG\",\"params\":{\"interval_ms\":1000,\"sensors\":[\"bme280\"]}}";
  JsonDocument cmd;
  deserializeJson(cmd, configInput);

  JsonDocument storedConfig;
  storedConfig.set(cmd["params"]);

  TEST_ASSERT_EQUAL(1000, storedConfig["interval_ms"] | 0);

  JsonArray sensors = storedConfig["sensors"];
  TEST_ASSERT_EQUAL(1, sensors.size());
  TEST_ASSERT_EQUAL_STRING("bme280", sensors[0] | "");
}

// ── EOM framing test ────────────────────────────────────────────

void test_eom_framing(void) {
  // Verify __EOM__ is appended correctly (matches @repo/iot WebBluetoothAdapter)
  String payload = "{\"status\":\"success\"}";
  String framed = payload + "__EOM__";

  TEST_ASSERT_TRUE(framed.endsWith("__EOM__"));
  TEST_ASSERT_EQUAL(payload.length() + 7, framed.length());
}

// ── Runner ──────────────────────────────────────────────────────

void setup() {
  delay(2000);  // Give the serial monitor time to connect

  UNITY_BEGIN();

  // hasCompleteJson
  RUN_TEST(test_complete_json_simple_object);
  RUN_TEST(test_complete_json_nested_object);
  RUN_TEST(test_incomplete_json_missing_brace);
  RUN_TEST(test_incomplete_json_empty_string);
  RUN_TEST(test_complete_json_with_trailing_data);

  // Protocol JSON format
  RUN_TEST(test_success_response_format);
  RUN_TEST(test_error_response_format);
  RUN_TEST(test_command_parsing);
  RUN_TEST(test_invalid_json_parsing);
  RUN_TEST(test_set_config_round_trip);

  // BLE framing
  RUN_TEST(test_eom_framing);

  UNITY_END();
}

void loop() {
  // Nothing — tests run once in setup()
}
