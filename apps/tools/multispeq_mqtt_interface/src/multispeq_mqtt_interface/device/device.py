import jii_multispeq.device as _device
import jii_multispeq.measurement as _measurement
from datetime import datetime
import json

class DeviceManager:
    @staticmethod
    def get_ports():
        """Get available ports"""
        ports = _device.get_ports()
        if ports is None:
            return []
        return [{'port': port.device, 'description': port.description} for port in ports]

    @staticmethod
    def connect_to_device(port):
        """Connect to a device using the specified port"""
        return _device.connect(port=port)

    @staticmethod
    def measure_and_analyze(connection):
        """Measure and analyze data using the device"""
        # MultispeQ Protocol
        spad_protocol = [{"spad": [1]}]

        # MultispeQ Response Analysis
        def spad_fn(_data):
            output = {}
            output["SPAD"] = _data["spad"][0]
            return output

        data = None
        try:
            # Measure using the device
            data, crc32 = _measurement.measure(
                connection, spad_protocol, None, "Single SPAD measurement"
            )

            # Run the analysis function
            data = _measurement.analyze(data, spad_fn)

            # View response as a table
            _measurement.view(data)

        except Exception as e:
            print(f"Error: {e}")
        finally:
            _device.disconnect(connection)

        # Save data to JSON file
        if data:
            # Create filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"multispeq_data_{timestamp}.json"

            # Save data to file
            with open(filename, 'w') as f:
                json.dump(data, f, indent=4)

            print(f"Data saved to {filename}")

        return data