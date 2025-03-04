# Message Format

This document describes the general message format used by the MultispeQ MQTT Interface tool. The exact message format can vary depending on the measurement protocol used.

## Message Payload Structure

The message payload is typically formatted as a JSON object. The structure of the payload includes metadata and measurement data.

### Example Message

Here is an example message for a SPAD measurement protocol:

```json
{
  "timestamp": 1633024800,
  "device_id": "device123",
  "measurements": {
    "SPAD": 42.5
  }
}
```

### Payload Components

- **timestamp**: Unix timestamp indicating when the measurement was taken.
- **device_id**: Unique identifier for the sensor device.
- **measurements**: An object containing the measurement data. The keys represent the measurement types, and the values are the corresponding measurement values.

## Custom Measurements

The message format can be extended to include custom measurements by modifying the `measure_and_analyze` method in the `DeviceManager` class.

### Example Custom Measurement

Here is an example for a custom protocol measuring leaf temperature:

```python
# Custom protocol for leaf temperature measurement
leaf_temp_protocol = [{"leaf_temp": [1, 2, 3]}]

# Analysis function
def leaf_temp_fn(data):
    output = {}
    output["LEAF_TEMP_AVG"] = sum(data["leaf_temp"]) / len(data["leaf_temp"])
    output["LEAF_TEMP_MAX"] = max(data["leaf_temp"])
    output["LEAF_TEMP_MIN"] = min(data["leaf_temp"])
    return output

# Use in measurement
data, crc32 = _measurement.measure(
    connection, leaf_temp_protocol, None, "Leaf Temperature Measurement"
)
data = _measurement.analyze(data, leaf_temp_fn)
```

### Example Message for Custom Measurement

```json
{
  "timestamp": 1633024800,
  "device_id": "device123",
  "measurements": {
    "LEAF_TEMP_AVG": 25.3,
    "LEAF_TEMP_MAX": 27.1,
    "LEAF_TEMP_MIN": 23.8
  }
}
```

## Data Types and Validation

### Data Types

- **timestamp**: Integer
- **device_id**: String
- **measurements**: Object with numeric values

### Validation

Ensure that the message payload adheres to the expected format. This can be done using a JSON schema validation library.

### Example Validation

```python
import jsonschema

schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "timestamp": {
      "type": "integer",
      "description": "Unix timestamp of the measurement"
    },
    "device_id": {
      "type": "string",
      "description": "Unique identifier for the sensor device"
    },
    "measurements": {
      "type": "object",
      "description": "Object containing measurement data",
      "properties": {
        "SPAD": {
          "type": "number",
          "description": "SPAD measurement value"
        },
        "LEAF_TEMP_AVG": {
          "type": "number",
          "description": "Average leaf temperature"
        },
        "LEAF_TEMP_MAX": {
          "type": "number",
          "description": "Maximum leaf temperature"
        },
        "LEAF_TEMP_MIN": {
          "type": "number",
          "description": "Minimum leaf temperature"
        }
      },
      "required": ["SPAD"]
    }
  },
  "required": ["timestamp", "device_id", "measurements"]
}

def validate_message(message):
    try:
        jsonschema.validate(instance=message, schema=schema)
        print("Message is valid")
    except jsonschema.exceptions.ValidationError as e:
        print(f"Message validation error: {e.message}")

# Example usage
message = {
  "timestamp": 1633024800,
  "device_id": "device123",
  "measurements": {
    "SPAD": 42.5
  }
}

validate_message(message)
```

By following these guidelines, you can ensure that the messages published by the MultispeQ MQTT Interface tool are well-structured and easily processed by the OpenJII platform.
