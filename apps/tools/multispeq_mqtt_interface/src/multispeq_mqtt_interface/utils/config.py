import os
from uuid import uuid4

class Config:
    def __init__(self):
        """Initialize configuration for AWS IoT Core MQTT client"""
        self.endpoint = os.getenv(
            "AWS_IOT_ENDPOINT", "a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com"
        )
        self.port = int(os.getenv("AWS_IOT_PORT", 8883))

        self.cert_filepath = os.getenv("AWS_IOT_CERT_FILEPATH", None)
        self.private_key_filepath = os.getenv("AWS_IOT_PRIVATE_KEY_FILEPATH", None)
        self.ca_filepath = os.getenv("AWS_IOT_CA_FILEPATH", None)

        self.client_id = os.getenv("AWS_IOT_CLIENT_ID", "test-" + str(uuid4()))
        self.topic = os.getenv(
            "AWS_IOT_TOPIC", "experiment/data_ingest/v1/{experiment_id}/multispeq/v1.0/cli_test_sensor_id/{protocol_id}"
        )

        self.keep_alive_secs = int(os.getenv("AWS_IOT_KEEP_ALIVE", "30"))
        self.clean_session = (
            os.getenv("AWS_IOT_CLEAN_SESSION", "False").lower() == "true"
        )

        self.proxy_host = os.getenv("AWS_IOT_PROXY_HOST", None)
        self.proxy_port = int(os.getenv("AWS_IOT_PROXY_PORT", "0"))

        # Plant data storage
        self.plant_data = None

    def display(self):
        print("\nAWS IoT Core Configuration:")
        print(f"Endpoint: {self.endpoint}")
        print(f"Port: {self.port}")
        print(f"Certificate path: {self.cert_filepath}")
        print(f"Private key path: {self.private_key_filepath}")
        print(f"CA path: {self.ca_filepath}")
        print(f"Client ID: {self.client_id}")
        print(f"Topic: {self.topic}")
        print(f"Keep alive: {self.keep_alive_secs} seconds")
        print(f"Clean session: {self.clean_session}")
        print(f"Proxy host: {self.proxy_host}")
        print(f"Proxy port: {self.proxy_port}")
        
        # Display plant data if available
        if self.plant_data:
            print("\nConfigured Plant Information:")
            print(f"Species: {self.plant_data.get('species', 'Not set')}")
            print(f"Age: {self.plant_data.get('age', 'Not set')}")
            print(f"Conditions: {self.plant_data.get('conditions', 'Not set')}")
            if self.plant_data.get('treatment'):
                print(f"Treatment: {self.plant_data['treatment']}")
            if self.plant_data.get('notes'):
                print(f"Notes: {self.plant_data['notes']}")
        else:
            print("\nPlant Information: Not configured")
        
        print()

    def update_plant_data(self, plant_data):
        """Update the stored plant data"""
        self.plant_data = plant_data
        print("\nPlant data has been updated in configuration.")
    

    def validate(self):
        issues = []
        # Check that certificate paths are provided and exist
        if not self.cert_filepath or not os.path.exists(self.cert_filepath):
            issues.append(f"Certificate file not found or not provided: {self.cert_filepath}")

        if not self.private_key_filepath or not os.path.exists(self.private_key_filepath):
            issues.append(f"Private key file not found or not provided: {self.private_key_filepath}")

        if not self.ca_filepath or not os.path.exists(self.ca_filepath):
            issues.append(f"CA file not found or not provided: {self.ca_filepath}")

        if not self.endpoint or "." not in self.endpoint:
            issues.append(f"Invalid endpoint: {self.endpoint}")

        return issues

    def update_topic(self, experiment_id, protocol_id):
        sensor_family = "multispeq"
        sensor_version = "v1.0"
        sensor_id = "cli_test_sensor_id"

        self.topic = f"experiment/data_ingest/v1/{experiment_id}/{sensor_family}/{sensor_version}/{sensor_id}/{protocol_id}"
        print(f"Updated topic: {self.topic}")