import os
from multispeq_mqtt_interface.device.device import DeviceManager

class PromptHandler:
    @staticmethod
    def prompt_topic_params(default_experiment_id=None, default_protocol_id=None):
        """Prompt the user to input the experiment ID and protocol ID"""
        while True:
            experiment_id = input(f"Enter the experiment ID [{default_experiment_id}]: ").strip() or default_experiment_id
            if experiment_id:
                break
            print("Experiment ID cannot be empty. Please try again.")

        while True:
            protocol_id = input(f"Enter the protocol ID [{default_protocol_id}]: ").strip() or default_protocol_id
            if protocol_id:
                break
            print("Protocol ID cannot be empty. Please try again.")

        return experiment_id, protocol_id

    @staticmethod
    def prompt_select_port():
        """Prompt the user to select a port from available ports"""
        ports = DeviceManager.get_ports()
        # if not ports:
        #     print("No available ports found.")
        #     return None

        # print("Available ports:")
        # for i, port in enumerate(ports):
        #     print(f"{i + 1}. {port['port']} - {port['description']}")

        while True:
            try:
                selection = int(input("Select a port by number: ").strip())
                if 1 <= selection <= len(ports):
                    return ports[selection - 1]['port']
                else:
                    print(f"Invalid selection. Please enter a number between 1 and {len(ports)}.")
            except ValueError:
                print("Invalid input. Please enter a number.")

    @staticmethod
    def prompt_cert_paths():
        r"""
        Prompt the user for the certificate ID and the directory where the AWS IoT certificate files are located.
        The directory should contain the following files:
          - <cert_id>-certificate.pem.crt
          - <cert_id>-private.pem.key
          - root-CA.pem

        The user must provide a full, absolute path to the directory.
        For example:
          - On Linux/macOS: /home/username/certs
          - On Windows: C:\\Users\\username\\certs
        """
        cert_id = input("Enter the certificate ID: ").strip()
        while not cert_id:
            print("Certificate ID cannot be empty. Please try again.")
            cert_id = input("Enter the certificate ID: ").strip()

        print("\nPlease provide the full, absolute path to the directory where the AWS IoT certificate files are located.")
        print("The directory should contain the following files:")
        print(f"  - {cert_id}-certificate.pem.crt")
        print(f"  - {cert_id}-private.pem.key")
        print("  - root-CA.pem")
        print("\nFor example:")
        print("  - On Linux/macOS: /home/username/certs")
        print("  - On Windows: C:\\Users\\username\\certs")
        directory = input("Enter the full path to the directory: ").strip()

        # Build full file paths based on the directory and cert_id
        cert_filepath = os.path.join(directory, f"{cert_id}-certificate.pem.crt")
        key_filepath = os.path.join(directory, f"{cert_id}-private.pem.key")
        ca_filepath = os.path.join(directory, "root-CA.pem")
        return cert_filepath, key_filepath, ca_filepath