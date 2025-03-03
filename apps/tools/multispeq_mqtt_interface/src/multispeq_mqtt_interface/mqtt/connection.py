from awscrt import mqtt, http
from awsiot import mqtt_connection_builder

class MQTTConnection:
    def __init__(self, config):
        """Initialize the MQTT connection with the provided configuration"""
        self.config = config
        self.connection = None
        self.connected = False

        proxy_options = None
        if self.config.proxy_host and self.config.proxy_port:
            proxy_options = http.HttpProxyOptions(
                host_name=self.config.proxy_host,
                port=self.config.proxy_port
            )

        self.connection = mqtt_connection_builder.mtls_from_path(
            endpoint=self.config.endpoint,
            port=self.config.port,
            cert_filepath=self.config.cert_filepath,
            pri_key_filepath=self.config.private_key_filepath,
            ca_filepath=self.config.ca_filepath,
            on_connection_interrupted=self.on_connection_interrupted,
            on_connection_resumed=self.on_connection_resumed,
            client_id=self.config.client_id,
            clean_session=self.config.clean_session,
            keep_alive_secs=self.config.keep_alive_secs,
            http_proxy_options=proxy_options
        )

    def on_connection_interrupted(self, connection, error, **kwargs):
        print(f"Connection interrupted. error: {error}")

    def on_connection_resumed(self, connection, return_code, session_present, **kwargs):
        print(f"Connection resumed. return_code: {return_code} session_present: {session_present}")
        if return_code == mqtt.ConnectReturnCode.ACCEPTED and not session_present:
            print("Session did not persist.")

    def connect(self):
        """Connect to AWS IoT Core using certificate-based authentication"""
        try:
            print(f"Connecting to {self.config.endpoint} with client ID '{self.config.client_id}'...")
            connect_future = self.connection.connect()
            connect_future.result(timeout=10)
            print("Connected!")
            self.connected = True
            return True

        except Exception as e:
            print(f"Connection error: {str(e)}")
            self.connected = False
            return False

    def disconnect(self):
        """Disconnect from AWS IoT Core"""
        try:
            if not self.connection:
                return True

            print("Disconnecting...")
            disconnect_future = self.connection.disconnect()
            disconnect_future.result(timeout=3)
            print("Disconnected!")
            self.connected = False
            self.connection = None
            return True

        except Exception as e:
            print(f"Disconnect error: {str(e)}")
            self.connected = False
            return False

    def is_connected(self):
        """Check if the connection is active"""
        if self.connection:
            try:
                state = self.connection.get_connection_state()
                return state == mqtt.ConnectionState.CONNECTED
            except:
                pass
        return self.connected and self.connection is not None