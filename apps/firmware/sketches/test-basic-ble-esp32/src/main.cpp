/**
 * Open-JII Generic Protocol Firmware
 * DFRobot FireBeetle 2 ESP32-S3 + BME280 + BH1750
 *
 * Implements the Generic Device Protocol from @repo/iot.
 * Communication:
 *   - USB Serial (115200 baud), newline-delimited JSON
 *   - BLE (Nordic UART Service), JSON with __EOM__ framing
 *
 * Protocol:
 *   Host sends:  {"command":"INFO"}\n
 *   Device replies: {"status":"success","data":{...}}\n
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Pin Configuration ───────────────────────────────────────────
#define I2C_SDA 1  // FireBeetle 2 ESP32-S3 default
#define I2C_SCL 2

// ── BLE Nordic UART Service UUIDs ───────────────────────────────
// Must match @repo/iot GENERIC_BLE_UUIDS in protocol/generic/config.ts
#define NUS_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define NUS_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
#define NUS_RX_UUID      "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_DEVICE_NAME  "Open-JII Sensor"
#define BLE_MTU_SIZE     512

// ── Buffer Limits ───────────────────────────────────────────────
static constexpr size_t MAX_INPUT_BUFFER = 2048;

// ── Sensors ─────────────────────────────────────────────────────
Adafruit_BME280 bme;
BH1750 lightMeter;
bool bmeReady     = false;
bool bh1750Ready  = false;

// ── BLE ─────────────────────────────────────────────────────────
BLEServer         *pServer            = nullptr;
BLECharacteristic *pTxCharacteristic  = nullptr;
volatile bool      bleConnected       = false;
bool               bleWasConnected    = false;

// Thread-safe BLE input buffer (written from BLE callback, read from loop)
static SemaphoreHandle_t bleMutex = nullptr;
String bleInputBuffer;

// ── Device State ────────────────────────────────────────────────
JsonDocument storedConfig;
bool configLoaded       = false;
bool measurementRunning = false;

// ── Serial Buffer ───────────────────────────────────────────────
String inputBuffer;

// ── Response Source ─────────────────────────────────────────────
enum Source { SRC_SERIAL, SRC_BLE };

// ── Forward Declarations ────────────────────────────────────────
void handleCommand(const String &line, Source src);
void sendResponse(JsonDocument &doc, Source src);
void sendSuccess(Source src);
void sendSuccess(JsonDocument &doc, Source src);
void sendError(const char *msg, Source src);
void sendBLE(const String &json);
String getFullMacId();
bool hasCompleteJson(const String &buf);

// ── BLE Callbacks ───────────────────────────────────────────────
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override   { bleConnected = true;  }
  void onDisconnect(BLEServer *) override { bleConnected = false; }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    // Only buffer data here — BTC_TASK stack is too small for JSON work.
    String value = String(pCharacteristic->getValue().c_str());
    if (xSemaphoreTake(bleMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
      if (bleInputBuffer.length() + value.length() <= MAX_INPUT_BUFFER) {
        bleInputBuffer += value;
      }
      // else: drop data to prevent OOM — host will get no response and retry
      xSemaphoreGive(bleMutex);
    }
  }
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/** Build a hex device ID from the full 6-byte ESP32 MAC address. */
String getFullMacId() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[13];
  snprintf(buf, sizeof(buf), "%04x%08x",
           (uint16_t)(mac >> 32),
           (uint32_t)(mac & 0xFFFFFFFF));
  return String(buf);
}

/** Check whether `buf` contains at least one complete JSON object (matched braces). */
bool hasCompleteJson(const String &buf) {
  int depth = 0;
  for (unsigned int i = 0; i < buf.length(); i++) {
    if (buf[i] == '{') depth++;
    else if (buf[i] == '}') depth--;
    if (depth == 0 && i > 0) return true;  // found one complete {...}
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Wait for USB CDC serial (ESP32-S3 native USB)
  unsigned long start = millis();
  while (!Serial && millis() - start < 3000) delay(10);

  // I2C
  Wire.begin(I2C_SDA, I2C_SCL);

  // BME280 — try both common addresses
  bmeReady = bme.begin(0x76) || bme.begin(0x77);

  // BH1750
  bh1750Ready = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23);

  // BLE mutex for thread-safe buffer access
  bleMutex = xSemaphoreCreateMutex();

  // BLE peripheral
  BLEDevice::init(BLE_DEVICE_NAME);
  BLEDevice::setMTU(BLE_MTU_SIZE);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(NUS_SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    NUS_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRx = pService->createCharacteristic(
    NUS_RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  pRx->setCallbacks(new RxCallbacks());

  pService->start();

  BLEAdvertising *pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(NUS_SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println(F(
    "{\"status\":\"success\",\"data\":"
    "{\"event\":\"boot\",\"message\":\"Open-JII device ready\"}}"));
}

// ─────────────────────────────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────────────────────────────
void loop() {
  // ── Serial input (newline-delimited) ──────────────────────────
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) handleCommand(inputBuffer, SRC_SERIAL);
      inputBuffer = "";
    } else if (inputBuffer.length() < MAX_INPUT_BUFFER) {
      inputBuffer += c;
    }
  }

  // ── BLE input (lock, copy, unlock — keep critical section tiny) ─
  String bleCopy;
  if (xSemaphoreTake(bleMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
    if (bleInputBuffer.length() > 0) {
      bleCopy = bleInputBuffer;
      bleInputBuffer = "";
    }
    xSemaphoreGive(bleMutex);
  }

  if (bleCopy.length() > 0) {
    // Process newline-delimited messages
    int nlPos;
    while ((nlPos = bleCopy.indexOf('\n')) >= 0) {
      String line = bleCopy.substring(0, nlPos);
      bleCopy = bleCopy.substring(nlPos + 1);
      line.trim();
      if (line.length() > 0) handleCommand(line, SRC_BLE);
    }
    // Handle single JSON object sent without trailing newline
    bleCopy.trim();
    if (bleCopy.length() > 0 && hasCompleteJson(bleCopy)) {
      handleCommand(bleCopy, SRC_BLE);
      bleCopy = "";
    }
    // If leftover partial data, put it back in the buffer
    if (bleCopy.length() > 0) {
      if (xSemaphoreTake(bleMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
        bleInputBuffer = bleCopy + bleInputBuffer;
        xSemaphoreGive(bleMutex);
      }
    }
  }

  // ── BLE reconnect advertising ─────────────────────────────────
  if (!bleConnected && bleWasConnected) {
    delay(100);
    BLEDevice::startAdvertising();
    bleWasConnected = false;
  }
  if (bleConnected && !bleWasConnected) {
    bleWasConnected = true;
  }

  yield();  // Let RTOS / watchdog breathe
}

// ─────────────────────────────────────────────────────────────────
// COMMAND ROUTER
// ─────────────────────────────────────────────────────────────────
void handleCommand(const String &line, Source src) {
  JsonDocument cmd;
  if (deserializeJson(cmd, line)) {
    sendError("Invalid JSON", src);
    return;
  }

  const char *command = cmd["command"] | "";

  // ── INFO ──────────────────────────────────────────────────────
  if (strcmp(command, "INFO") == 0) {
    JsonDocument resp;
    JsonObject data = resp["data"].to<JsonObject>();
    data["device_name"]       = "Open-JII Sensor Node";
    data["device_type"]       = "environmental_sensor";
    data["device_version"]    = "1.0.0";
    data["device_id"]         = getFullMacId();
    data["firmware_version"]  = "0.1.0";

    JsonArray caps = data["capabilities"].to<JsonArray>();
    if (bmeReady) { caps.add("temperature"); caps.add("humidity"); caps.add("pressure"); }
    if (bh1750Ready) caps.add("light");
    caps.add("bluetooth");

    // Sensor status
    JsonObject sensors = data["sensors"].to<JsonObject>();
    
    JsonObject bme = sensors["bme280"].to<JsonObject>();
    bme["connected"] = bmeReady;
    bme["type"] = "temperature_humidity_pressure";
    bme["i2c_address"] = "0x76/0x77";
    
    JsonObject bh = sensors["bh1750"].to<JsonObject>();
    bh["connected"] = bh1750Ready;
    bh["type"] = "light";
    bh["i2c_address"] = "0x23";

    sendSuccess(resp, src);
  }

  // ── DISCOVER ──────────────────────────────────────────────────
  else if (strcmp(command, "DISCOVER") == 0) {
    static const char *const CMD_LIST[] = {
      "INFO", "DISCOVER", "SET_CONFIG", "GET_CONFIG", "RUN",
      "STOP", "GET_DATA", "RESET", "PING", "DISCONNECT"
    };
    JsonDocument resp;
    JsonArray cmds = resp["data"]["commands"].to<JsonArray>();
    for (const char *c : CMD_LIST) cmds.add(c);
    sendSuccess(resp, src);
  }

  // ── PING ──────────────────────────────────────────────────────
  else if (strcmp(command, "PING") == 0) {
    JsonDocument resp;
    resp["data"]["pong"]      = true;
    resp["data"]["uptime_ms"] = millis();
    sendSuccess(resp, src);
  }

  // ── SET_CONFIG ────────────────────────────────────────────────
  else if (strcmp(command, "SET_CONFIG") == 0) {
    if (!cmd["params"].is<JsonObject>()) {
      sendError("Missing 'params' object", src);
      return;
    }
    storedConfig.clear();
    storedConfig.set(cmd["params"]);
    configLoaded = true;
    sendSuccess(src);
  }

  // ── GET_CONFIG ────────────────────────────────────────────────
  else if (strcmp(command, "GET_CONFIG") == 0) {
    JsonDocument resp;
    if (configLoaded) resp["data"].set(storedConfig);
    else              resp["data"] = nullptr;
    sendSuccess(resp, src);
  }

  // ── RUN ───────────────────────────────────────────────────────
  else if (strcmp(command, "RUN") == 0) {
    measurementRunning = true;
    sendSuccess(src);
  }

  // ── STOP ──────────────────────────────────────────────────────
  else if (strcmp(command, "STOP") == 0) {
    measurementRunning = false;
    sendSuccess(src);
  }

  // ── GET_DATA ──────────────────────────────────────────────────
  else if (strcmp(command, "GET_DATA") == 0) {
    JsonDocument resp;
    JsonObject data   = resp["data"].to<JsonObject>();
    JsonObject values = data["data"].to<JsonObject>();

    if (bmeReady) {
      values["temperature_c"]  = bme.readTemperature();
      values["humidity_pct"]   = bme.readHumidity();
      values["pressure_hpa"]   = bme.readPressure() / 100.0F;
    }
    if (bh1750Ready) {
      values["light_lux"] = lightMeter.readLightLevel();
    }
    data["timestamp"] = millis();
    sendSuccess(resp, src);
  }

  // ── RESET ─────────────────────────────────────────────────────
  else if (strcmp(command, "RESET") == 0) {
    storedConfig.clear();
    configLoaded = false;
    measurementRunning = false;
    sendSuccess(src);
  }

  // ── DISCONNECT ────────────────────────────────────────────────
  else if (strcmp(command, "DISCONNECT") == 0) {
    sendSuccess(src);
  }

  // ── UNKNOWN ───────────────────────────────────────────────────
  else {
    String msg = "Unknown command: ";
    msg += command;
    sendError(msg.c_str(), src);
  }
}

// ─────────────────────────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────────

void sendResponse(JsonDocument &doc, Source src) {
  String json;
  serializeJson(doc, json);
  Serial.println(json);
  if (src == SRC_BLE) sendBLE(json);
}

/** Send {"status":"success"} with no data payload. */
void sendSuccess(Source src) {
  JsonDocument resp;
  resp["status"] = "success";
  sendResponse(resp, src);
}

/** Stamp doc with status=success, then send. */
void sendSuccess(JsonDocument &doc, Source src) {
  doc["status"] = "success";
  sendResponse(doc, src);
}

void sendError(const char *msg, Source src) {
  JsonDocument resp;
  resp["status"] = "error";
  resp["error"]  = msg;
  sendResponse(resp, src);
}

/**
 * Send a string over BLE with __EOM__ framing.
 * Chunks into MTU-sized packets to match WebBluetoothAdapter in @repo/iot.
 */
void sendBLE(const String &json) {
  if (!bleConnected || !pTxCharacteristic) return;

  String payload = json + "__EOM__";
  const size_t chunkSize = BLE_MTU_SIZE - 3;  // ATT overhead

  for (size_t off = 0; off < payload.length(); off += chunkSize) {
    size_t len = min(chunkSize, payload.length() - off);
    pTxCharacteristic->setValue((uint8_t *)payload.c_str() + off, len);
    pTxCharacteristic->notify();
    delay(10);
  }
}
