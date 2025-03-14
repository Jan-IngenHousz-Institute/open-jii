import jii_multispeq.device as _device
import jii_multispeq.measurement as _measurement
from datetime import datetime
import json
import os

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
    def disconnect_device(connection):
        """Disconnect from a device"""
        if connection:
            try:
                _device.disconnect(connection)
                return True
            except Exception as e:
                print(f"Error disconnecting from device: {e}")
                return False
        return True

    @staticmethod
    def measure_and_analyze(connection, plant_data=None):
        """Measure and analyze data using the device"""
        # MultispeQ Protocol
        spad_protocol = [{"spad": [1]}]

        # MultispeQ Response Analysis
        def spad_fn(_data):
            output = {}
            output["SPAD"] = _data["spad"][0]
            
            # Include plant data if provided
            if plant_data:
                output["plant_info"] = plant_data
                
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


        # Save data to JSON file
        if data:
            # Create filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Include species in filename if available
            if plant_data and plant_data.get("species"):
                species = plant_data["species"].replace(" ", "_").lower()
                filename = f"multispeq_data_{species}_{timestamp}.json"
            else:
                filename = f"multispeq_data_{timestamp}.json"
            
            # Create dump directory if it doesn't exist
            dump_dir = "./dump"
            os.makedirs(dump_dir, exist_ok=True)
            
            # Save data to file in dump directory
            filepath = os.path.join(dump_dir, filename)
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=4)

            print(f"Data saved to {filepath}")

        return data