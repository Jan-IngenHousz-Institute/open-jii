import os
import json
import time
import threading
from datetime import datetime
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

        # Check if we have stored plant data
        plant_data = None
        if self.config.plant_data:
            print(f"\nUsing configured plant data: {self.config.plant_data['species']} ({self.config.plant_data['age']})")
            use_stored = input("Use this plant data? (y/n, default=y): ").lower() or 'y'
            if use_stored == 'y':
                plant_data = self.config.plant_data
        
        # If no stored data or user chose not to use it, prompt for new data
        if not plant_data:
            print("\nPlease enter information about the plant being measured:")
            plant_data = PromptHandler.prompt_plant_data()
            
            # Ask if they want to save this plant data for future measurements
            save_data = input("\nSave this plant data for future measurements? (y/n): ").lower()
            if save_data == 'y':
                self.config.update_plant_data(plant_data)
        
        # Measure and analyze data using the device
        data = DeviceManager.measure_and_analyze(self.device_connection)
        
        if data:
            # Add user-provided plant metadata to the data payload
            data["plant_metadata"] = plant_data
            
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

    def continuous_publish(self):
        """Continuously publish measurements every 6 seconds until stopped"""
        # Check if we're connected
        if not self.mqtt_client.is_connected():
            print("Not connected to AWS IoT Core. Use 'connect' first.")
            return

        # Connect to the device
        port = "/dev/cu.usbmodem42949672951"
        if not port:
            print("No port selected. Aborting continuous measurement.")
            return
        
        self.device_connection = DeviceManager.connect_to_device(port)
        if not self.device_connection:
            print(f"Failed to connect to device on port {port}")
            return

        # Check if we have stored plant data
        plant_data = None
        if self.config.plant_data:
            print(f"\nUsing configured plant data: {self.config.plant_data['species']} ({self.config.plant_data['age']})")
            use_stored = input("Use this plant data? (y/n, default=y): ").lower() or 'y'
            if use_stored == 'y':
                plant_data = self.config.plant_data
        
        # If no stored data or user chose not to use it, prompt for new data
        if not plant_data:
            print("\nPlease enter information about the plant being measured:")
            plant_data = PromptHandler.prompt_plant_data()
            
            # Ask if they want to save this plant data for future measurements
            save_data = input("\nSave this plant data for future measurements? (y/n): ").lower()
            if save_data == 'y':
                self.config.update_plant_data(plant_data)
        
        
        # Set up a flag for stopping the continuous publishing
        self._stop_continuous = False
        
        # Start a thread to listen for user input to stop the loop
        stop_thread = threading.Thread(target=self._listen_for_stop)
        stop_thread.daemon = True
        stop_thread.start()
        
        print("\nStarting continuous publishing. Press Enter to stop.")
        print("Publishing measurements every 6 seconds...\n")
        
        measurement_count = 0
        start_time = datetime.now()
        
        try:
            while not self._stop_continuous:
                # Clear terminal
                os.system('cls' if os.name == 'nt' else 'clear')
                
                # Display session info
                current_time = datetime.now()
                elapsed = (current_time - start_time).total_seconds()
                print(f"=== CONTINUOUS MEASUREMENT SESSION ===")
                print(f"Started: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"Running time: {int(elapsed//60)}m {int(elapsed%60)}s")
                print(f"Measurements taken: {measurement_count}")
                print(f"Device: {port}")
                print(f"Plant: {plant_data['species']} ({plant_data['age']})")
                print(f"Topic: {self.config.topic}")
                print("\nPress Enter to stop the continuous publishing loop.")
                print("=" * 40)
                
                # Measure and analyze data using the device
                data = DeviceManager.measure_and_analyze(self.device_connection)
                
                if data:
                    # Add user-provided plant metadata
                    data["plant_metadata"] = plant_data
                    
                    # Add timestamp
                    data["timestamp"] = datetime.now().isoformat()
                    
                    # Display simplified measurement data
                    print(f"\nMeasurement #{measurement_count + 1} at {current_time.strftime('%H:%M:%S')}: {data['SPAD']} (SPAD)")
                    
                    # Publish the data
                    success = self.mqtt_client.publish(data)
                    if success:
                        print("\nPublish successful ✓")
                        measurement_count += 1
                    else:
                        print("\nPublish failed ✗")
                else:
                    print("\nERROR: Failed to obtain measurement data")
                
                # Wait for the next measurement cycle
                for _ in range(6):
                    if self._stop_continuous:
                        break
                    time.sleep(1)
        
        except KeyboardInterrupt:
            print("\nContinuous publishing stopped by user.")
        finally:
            # Disconnect from device
            if self.device_connection:
                DeviceManager.disconnect_device(self.device_connection)
                print("Disconnected from device.")
            
            print("\nContinuous publishing session ended.")
            print(f"Total measurements published: {measurement_count}")
            self._stop_continuous = True
    
    def _listen_for_stop(self):
        """Listen for user input to stop the continuous publishing loop"""
        input()  # Wait for Enter key
        self._stop_continuous = True
        print("\nStopping after current measurement completes...")
        

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
    
    def set_plant_data(self):
        """Set or update the plant data in configuration"""
        print("\nConfiguring default plant information...")
        print("This information will be used for all measurements until changed.")
        
        # Display current plant data if it exists
        if self.config.plant_data:
            print("\nCurrent plant information:")
            for key, value in self.config.plant_data.items():
                if value:  # Only print if value is not None or empty
                    print(f"  {key.capitalize()}: {value}")
            
            update = input("\nDo you want to update this information? (y/n): ").lower()
            if update != 'y':
                print("Plant data remains unchanged.")
                return
        
        # Get new plant data
        plant_data = PromptHandler.prompt_plant_data()
        self.config.update_plant_data(plant_data)

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

        # Disconnect from MQTT if connected
        if self.mqtt_client.is_connected():
            self.disconnect()

        # Disconnect from device if connected
        if hasattr(self, 'device_connection') and self.device_connection:
            DeviceManager.disconnect_device(self.device_connection)
            print("Disconnected from device.")

        import sys
        sys.exit(0)