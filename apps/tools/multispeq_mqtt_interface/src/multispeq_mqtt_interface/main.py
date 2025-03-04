import sys
from multispeq_mqtt_interface.cli.interface import start_cli


def main():
    try:
        print("Starting IoT MQTT CLI...")
        start_cli()
    except KeyboardInterrupt:
        print("\nExiting the application.")
        sys.exit(0)
    except Exception as e:
        print(f"\nError: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
