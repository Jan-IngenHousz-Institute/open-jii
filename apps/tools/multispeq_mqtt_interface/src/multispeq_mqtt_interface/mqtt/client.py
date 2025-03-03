import json
import platform
import subprocess
from multispeq_mqtt_interface.mqtt.connection import MQTTConnection
from multispeq_mqtt_interface.utils.config import Config
from awscrt import mqtt

class MQTTClient:
    def __init__(self, config):
        """Initialize AWS IoT Core MQTT client with configuration"""
        self.config = config
        self.connection = None

    def connect(self):
        """Connect to AWS IoT Core using certificate-based authentication."""
        try:
            self.connection = MQTTConnection(self.config)
            result = self.connection.connect()
            return result
        except Exception as e:
            raise

    def disconnect(self):
        """Disconnect from AWS IoT Core."""
        if self.connection:
            try:
                result = self.connection.disconnect()
            except Exception as e:
                raise
            finally:
                self.connection = None
            return result
        return None

    def is_connected(self):
        """Check if the client is connected to AWS IoT Core."""
        return self.connection is not None and self.connection.is_connected()
    
    def publish(self, message_data):
        """Publish a message to the configured topic"""
        if not self.is_connected():
            print("DEBUG: Not connected")
            return None

        try:
            payload = json.dumps(message_data)
            print(f"DEBUG: Publishing to topic: {self.config.topic}")
            print(f"DEBUG: Payload size: {len(payload)} bytes")
            publish_future, _ = self.connection.connection.publish(
                topic=self.config.topic,
                payload=payload,
                qos=mqtt.QoS.AT_LEAST_ONCE
            )
            print("DEBUG: Waiting for publish confirmation...")
            publish_future.result()
            print("DEBUG: Publish completed")
            return True

        except Exception as e:
            print(f"DEBUG: Publishing error: {str(e)}")
            print(f"DEBUG: Error type: {type(e).__name__}")
            error_msg = str(e)
            if "AccessDeniedException" in error_msg:
                print("ERROR: Authorization failed - check your policy")
            elif "Connection" in error_msg:
                print("ERROR: Connection issues - check your network")
            return None

    def ping(self):
        """Test the connection by pinging the broker's hostname"""
        try:
            if not self.is_connected():
                print("DEBUG: Not connected according to local state")
                return False

            hostname = self.config.endpoint.split(":")[0]
            param = "-n" if platform.system().lower() == "windows" else "-c"
            command = ["ping", param, "1", hostname]
            result = subprocess.run(
                command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5
            )
            return result.returncode == 0

        except Exception as e:
            print(f"DEBUG: Ping failed: {str(e)}")
            return False