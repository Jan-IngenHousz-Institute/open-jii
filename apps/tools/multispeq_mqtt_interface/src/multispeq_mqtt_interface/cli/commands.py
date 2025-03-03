import json
import time
from multispeq_mqtt_interface.mqtt.client import MQTTClient
from multispeq_mqtt_interface.utils.config import Config
from multispeq_mqtt_interface.cli.prompts import PromptHandler
from multispeq_mqtt_interface.device.device import DeviceManager


class CommandHandler:
    def __init__(self):
        """Initialize the command handler with configuration and MQTT client"""
        self.config = Config()
        self.mqtt_client = MQTTClient(self.config)
        self.device_connection = None

    def _get_default_message(self):
        """Generate a default test message"""
        return {
            "timestamp": time.time(),
            "device_id": self.config.client_id,
            "measurements": {
                "test": True,
                "value": 42,
                "message": "Test message from IoT MQTT CLI",
            },
        }

    def connect(self):
        """Connect to AWS IoT Core MQTT broker"""

        if self.mqtt_client.is_connected():
            print(f"\nAlready connected to MQTT broker at {self.config.endpoint}!")
            return

        # Extract current experiment_id and protocol_id from the topic
        current_experiment_id = self.config.topic.split('/')[3]
        current_protocol_id = self.config.topic.split('/')[-1]

        # Prompt the user to input the topic parameters
        experiment_id, protocol_id = PromptHandler.prompt_topic_params(current_experiment_id, current_protocol_id)
        self.config.update_topic(experiment_id, protocol_id)

        # Prompt the user for certificate information (ID and directory path)
        cert_filepath, key_filepath, ca_filepath = PromptHandler.prompt_cert_paths()
        if cert_filepath:
            self.config.cert_filepath = cert_filepath
        if key_filepath:
            self.config.private_key_filepath = key_filepath
        if ca_filepath:
            self.config.ca_filepath = ca_filepath

        print(f"\nConnecting to AWS IoT Core at {self.config.endpoint}...")

        # Validate configuration before connecting
        issues = self.config.validate()
        if issues:
            print("Configuration issues detected:")
            for issue in issues:
                print(f"- {issue}")
            print("Please fix these issues before connecting.")
            return

        result = self.mqtt_client.connect()
        if result:
            print("Connected successfully to AWS IoT Core!")
        else:
            print("Failed to connect. Check your credentials and network connection.")

    def disconnect(self):
        """Disconnect from AWS IoT Core MQTT broker"""
        if not self.mqtt_client.is_connected():
            print("Not currently connected to AWS IoT Core.")
            return

        try:
            result = self.mqtt_client.disconnect()
            if result:
                print("Disconnected successfully from AWS IoT Core.")
            else:
                print("Failed to disconnect properly.")
        except Exception as e:
            print(f"Disconnect error: {str(e)}")
            print("Failed to disconnect properly.")

    def test_connection(self):
        """Test the connection to AWS IoT Core"""
        if not self.mqtt_client.is_connected():
            print("Not connected to AWS IoT Core. Use 'connect' first.")
            return

        print("Testing connection to AWS IoT Core...")
        result = self.mqtt_client.ping()
        if result:
            print("Connection test successful!")
        else:
            print("Connection test failed. The connection may have been lost.")

    def publish(self, data_str=None):
        """Publish a message to the configured topic"""
        # Check if we're connected
        if not self.mqtt_client.is_connected():
            print("Not connected to AWS IoT Core. Use 'connect' first.")
            return

        # Connect to the device
        port = "/dev/cu.usbmodem42949672951"
        if not port:
            print("No port selected. Aborting measurement.")
            return
        
        self.device_connection = DeviceManager.connect_to_device(port)
        if not self.device_connection:
            print(f"Failed to connect to device on port {port}")
            return

        # Measure and analyze data using the device
        data = DeviceManager.measure_and_analyze(self.device_connection)

        if data:
            # Prepare the message payload
            # message = {
            #     "timestamp": time.time(),
            #     "device_id": self.config.client_id,
            #     "measurement": data
            # }

            print(f"Publishing message to topic {self.config.topic}")
            print(f"Message content: {json.dumps(data, indent=2)}")

            try:
                packet_id = self.mqtt_client.publish(data)
                if packet_id:
                    print(f"Message published successfully with ID: {packet_id}")
                    return True
                else:
                    print("Failed to publish message.")
                    return False
            except Exception as e:
                print(f"Publishing error: {str(e)}")
                return False
        else:
            print("No data to publish.")

    def status(self):
        """Display the current connection status"""
        connection_status = (
            "Connected" if self.mqtt_client.is_connected() else "Disconnected"
        )
        print(f"Connection status: {connection_status}")

        if self.mqtt_client.is_connected():
            print(f"Connected to: {self.config.endpoint}")
            print(f"Client ID: {self.config.client_id}")
            print(f"Topic: {self.config.topic}")

    def display_config(self):
        """Display the current configuration"""
        self.config.display()

    def set_topic_params(self):
        """Prompt the user to input the experiment ID and protocol ID"""
        # Extract current experiment_id and protocol_id from the topic
        current_experiment_id = self.config.topic.split('/')[3]
        current_protocol_id = self.config.topic.split('/')[-1]

        # Prompt the user to input the topic parameters
        experiment_id, protocol_id = PromptHandler.prompt_topic_params(current_experiment_id, current_protocol_id)
        self.config.update_topic(experiment_id, protocol_id)
        # Re-establish the connection after updating the topic parameters
        if self.mqtt_client.is_connected():
            self.disconnect()
            self.connect()

    def connect_device(self):
        """Connect to a device from a selected port"""
        port = "/dev/cu.usbmodem42949672951"
        if port:
            self.device_connection = DeviceManager.connect_to_device(port)
            if self.device_connection:
                print(f"Connected to device on port {port}")
            else:
                print(f"Failed to connect to device on port {port}")
    
    def exit(self):
        """Exit the application gracefully."""
        print("Quitting and cleaning up connections...")

        if self.mqtt_client.is_connected():
            self.disconnect()

        import sys
        sys.exit(0)