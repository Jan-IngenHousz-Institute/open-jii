# Advanced Options

This guide covers advanced usage patterns for the MultispeQ MQTT Interface tool, providing deeper insights into customization options and optimization techniques beyond basic configuration.

## Advanced Topic Structure Management

Beyond the basic topic configuration detailed in the Configuration document, you can implement dynamic topic generation based on:

1. Experiment-specific requirements
2. Device grouping schemes
3. Protocol hierarchies

Example of advanced topic structure implementation:

```python
def generate_dynamic_topic(experiment_type, location_id, protocol_type):
    """Generate a topik with hierarchical organization"""
    return (
        f"experiment/data_ingest/v1/{experiment_type}/"
        f"location/{location_id}/multispeq/v1.0/{get_device_id()}/{protocol_type}"
    )

# Usage
topic = generate_dynamic_topic("greenhouse", "north-wing-3", "photosynthesis-extended")
config.topic = topic
```

## Certificate Management Best Practices

### Secure Certificate Storage

Store your certificates in a location with appropriate permissions:

```bash
mkdir -p ~/.aws-iot-certificates
chmod 700 ~/.aws-iot-certificates
```

Copy your certificates to this location:

```bash
cp <cert_id>-certificate.pem.crt ~/.aws-iot-certificates/
cp <cert_id>-private.pem.key ~/.aws-iot-certificates/
cp root-CA.pem ~/.aws-iot-certificates/
chmod 600 ~/.aws-iot-certificates/*
```

### Certificate Rotation

For production environments, implement certificate rotation policies:

1. Create new certificates in the AWS IoT Core console
2. Deploy new certificates to devices
3. Test with new certificates while keeping old ones active
4. Deactivate old certificates after successful transition

## Custom Measurement Protocols

The MultispeQ MQTT Interface supports custom measurement protocols beyond the default SPAD measurement:

1. Create a custom protocol definition array
2. Define an appropriate analysis function
3. Replace the default protocol in the `measure_and_analyze` method

Example for a custom protocol:

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

## Message Payload Optimization

When working with large datasets or constrained networks, consider these optimization techniques:

1. **Selective Data Publishing**: Include only essential metrics in published messages
2. **Compression**: Apply compression to larger payloads
3. **Batching**: Combine multiple measurements into a single message

Example of selective data publishing:

```python
# Extract only necessary data fields
def optimize_payload(data):
    return {
        "timestamp": data.get("timestamp"),
        "device_id": data.get("device_id"),
        "SPAD": data.get("SPAD"),
        # Add only essential fields
    }

optimized_data = optimize_payload(complete_data)
```

## Connection Resilience

For improved connection reliability in challenging network environments:

1. **Automatic Reconnection**: Implement connection retry logic

   ```python
   def connect_with_retry(mqtt_client, max_attempts=5):
       attempts = 0
       while attempts < max_attempts:
           if mqtt_client.connect():
               return True
           attempts += 1
           print(f"Connection attempt {attempts} failed. Retrying...")
           time.sleep(2 ** attempts)  # Exponential backoff
       return False
   ```

2. **Message Queueing**: Store messages locally when disconnected and send when reconnected

   ```python
   def publish_with_queue(mqtt_client, topic, message, queue_file="message_queue.json"):
       if mqtt_client.is_connected():
           success = mqtt_client.publish(topic, message)
           if success:
               # Also send any queued messages
               send_queued_messages(mqtt_client, queue_file)
               return True

       # If not connected or publish failed, queue the message
       queue_message(topic, message, queue_file)
       return False
   ```

3. **Connection Health Monitoring**: Implement a background thread to periodically check connection status

   ```python
   import threading
   import time

   def connection_monitor(mqtt_client, interval=60):
       """Monitor connection health and attempt reconnection if needed"""
       while True:
           if not mqtt_client.is_connected():
               print("Connection lost. Attempting to reconnect...")
               mqtt_client.connect()
           time.sleep(interval)

   # Start the monitor in a background thread
   monitor_thread = threading.Thread(
       target=connection_monitor,
       args=(mqtt_client, 60),
       daemon=True
   )
   monitor_thread.start()
   ```

## Debugging and Troubleshooting

Enable more verbose logging by setting environment variables:

```bash
export AWS_LOG_LEVEL=DEBUG
```

Detailed connection diagnostics:

```bash
# Check network connectivity to endpoint
ping <your-aws-iot-endpoint>

# Test TLS connectivity
openssl s_client -connect <your-aws-iot-endpoint>:8883
```

Verify certificate validity:

```bash
openssl x509 -in <cert_id>-certificate.pem.crt -text -noout
```

## Integration with Automated Systems

For use in automated scripts or CI/CD pipelines:

```bash
#!/bin/bash
# Example script for automated data collection with extensive error handling

# Set environment variables
export AWS_IOT_CERT_FILEPATH="/path/to/certificate.pem.crt"
export AWS_IOT_PRIVATE_KEY_FILEPATH="/path/to/private.key"
export AWS_IOT_CA_FILEPATH="/path/to/root-CA.pem"
export AWS_IOT_CLIENT_ID="automated-client-$(date +%s)"
export AWS_IOT_TOPIC="experiment/data_ingest/v1/greenhouse-auto/multispeq/v1.0/device123/daily-scan"

# Function for error handling
handle_error() {
    echo "ERROR: $1" >&2
    # Send alert (email, Slack, etc.)
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"MultispeQ Error: $1\"}" \
         https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
    exit 1
}

# Run scheduled measurement with robust error handling
python -c "
import sys
from multispeq_mqtt_interface.utils.config import Config
from multispeq_mqtt_interface.mqtt.client import MQTTClient
from multispeq_mqtt_interface.device.device import DeviceManager

try:
    # Initialize configuration
    config = Config()

    # Validate configuration
    issues = config.validate()
    if issues:
        print('Configuration issues:')
        for issue in issues:
            print(f'- {issue}')
        sys.exit(1)

    # Create and connect client
    client = MQTTClient(config)
    if not client.connect():
        sys.exit(2)

    # Connect to device
    port = '/dev/ttyACM0'  # Adjust based on your system
    device_conn = DeviceManager.connect_to_device(port)
    if not device_conn:
        sys.exit(3)

    # Measure and publish
    data = DeviceManager.measure_and_analyze(device_conn)
    if not data:
        sys.exit(4)

    if not client.publish(data):
        sys.exit(5)

    print('Measurement published successfully')

    # Disconnect
    client.disconnect()

except Exception as e:
    print(f'Unexpected error: {str(e)}')
    sys.exit(99)
" || handle_error "Measurement failed with exit code $?"
```

## High-Throughput Scenarios

For applications requiring frequent measurements:

```python
import time
import threading
from queue import Queue

class MeasurementWorker:
    def __init__(self, device_port, mqtt_client, measurement_interval=60):
        self.device_port = device_port
        self.mqtt_client = mqtt_client
        self.measurement_interval = measurement_interval
        self.running = False
        self.message_queue = Queue()
        self.worker_thread = None

    def start(self):
        """Start periodic measurements"""
        self.running = True
        self.worker_thread = threading.Thread(target=self._measurement_loop)
        self.worker_thread.daemon = True
        self.worker_thread.start()

    def stop(self):
        """Stop measurements"""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5.0)

    def _measurement_loop(self):
        """Main measurement loop"""
        while self.running:
            try:
                # Connect to device
                device_conn = DeviceManager.connect_to_device(self.device_port)
                if device_conn:
                    # Take measurement
                    data = DeviceManager.measure_and_analyze(device_conn)
                    if data and self.mqtt_client.is_connected():
                        self.mqtt_client.publish(data)
                    else:
                        # Queue for later if not connected
                        self.message_queue.put(data)
            except Exception as e:
                print(f"Measurement error: {e}")

            # Wait until next measurement interval
            time.sleep(self.measurement_interval)
```

This high-throughput approach enables continuous data collection with automatic error recovery and message queuing when connectivity is intermittent.
