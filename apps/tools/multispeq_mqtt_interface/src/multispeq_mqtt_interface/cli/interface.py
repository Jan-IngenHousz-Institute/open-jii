import cmd
import sys
import os
import traceback
from multispeq_mqtt_interface.cli.commands import CommandHandler


class IoTMqttCli(cmd.Cmd):
    """AWS IoT Core MQTT Command Line Interface"""

    intro = """
╔════════════════════════════════════════════════════════════════════════════╗
║  __  __       _ _   _                  ___                          ║ v0.1 ║
║ |  \/  |_   _| | |_(_)___ _ __   ___  / _ \                          ══════║
║ | |\/| | | | | | __| / __| '_ \ / _ \| | | |                               ║
║ | |  | | |_| | | |_| \__ \ |_) |  __/\ |_| |                               ║
║ |_|  |_|\__,_|_|\__|_|___/ .__/ \___| \__\_\                               ║
║                          |_|       MQTT Connection Tool                    ║
╠════════════════════════════════════════════════════════════════════════════╣
║ Available commands:                                                        ║
║  [C] connect                   - Connect to AWS IoT Core                   ║
║  [D] disconnect                - Disconnect from broker                    ║
║  [P] ping                      - Test connection to endpoint               ║
║  [M] measure                   - Measure and publish a reading to topic    ║
║  [K] continuous measure        - Continuously measure and publish readings ║
║  [S] status                    - Check connection status                   ║
║  [F] config                    - Show current configuration                ║
║  [F] plant config              - Set plant metadata                        ║
║  [T] set_topic                 - Set topic parameters                      ║
║  [V] connect_device            - Connect to a device from a selected port  ║
║  [H] help                      - Show detailed help                        ║
║  [Q] quit/exit                 - Exit application                          ║
╚════════════════════════════════════════════════════════════════════════════╝
"""
    prompt = "MultispeQ > "

    def __init__(self):
        super().__init__()
        self.command_handler = CommandHandler()
        # Define command shortcuts
        self.shortcuts = {
            "c": "connect",
            "d": "disconnect",
            "p": "ping",
            "m": "publish",
            "k": "continuous_publish",
            "s": "status",
            "f": "config",
            "t": "set_topic",
            "v": "connect_device",
            "h": "help",
            "q": "exit",
        }

    def do_connect(self, arg):
        """[C] Connect to the AWS IoT Core MQTT broker"""
        self.command_handler.connect()

    def do_disconnect(self, arg):
        """[D] Disconnect from the MQTT broker"""
        self.command_handler.disconnect()

    def do_ping(self, arg):
        """[P] Test connection to AWS IoT endpoint"""
        self.command_handler.test_connection()

    def do_publish(self, arg):
        """[M] Measure using device and publish a message to the configured topic"""
        self.command_handler.publish(arg)

    def do_continuous_publish(self, arg):
        """[K] Continuously measure and publish messages every 6 seconds until stopped"""
        self.command_handler.continuous_publish()

    def do_status(self, arg):
        """[S] Check current connection status"""
        self.command_handler.status()

    def do_config(self, arg):
        """[F] Display current configuration"""
        self.command_handler.display_config()

    def do_set_topic(self, arg):
        """[T] Set topic parameters"""
        self.command_handler.set_topic_params()

    def do_connect_device(self, arg):
        """[V] Connect to a device from a selected port"""
        self.command_handler.connect_device()
        
    def do_set_plant(self, arg):
        """[P] Set default plant information for measurements"""
        self.command_handler.set_plant_data() 

    def do_exit(self, arg):
        """[Q] Exit the application"""
        self.command_handler.exit()
        return True

    def do_quit(self, arg):
        """[Q] Exit the application"""
        return self.command_handler.exit()

    def do_clear(self, arg):
        """Clear the screen"""
        os.system("cls" if os.name == "nt" else "clear")
        print(self.intro)

    def default(self, line):
        """Handle shortcuts and unknown commands"""
        # Check if input is a single-letter shortcut
        if len(line) == 1 and line.lower() in self.shortcuts:
            # Get the full command name for the shortcut
            full_command = self.shortcuts[line.lower()]
            # Call the appropriate method using getattr
            getattr(self, f"do_{full_command}")("")
            return

        # Not a recognized shortcut
        print(f"Unknown command: {line}")
        print("Type 'help' or 'H' for a list of available commands")

    def emptyline(self):
        """Do nothing on empty line"""
        pass

    def print_topics(self, header, cmds, cmdlen, maxcol):
        """Override to format help with shortcut letters highlighted"""
        if not cmds:
            return
        super().print_topics(header, cmds, cmdlen, maxcol)


def start_cli():
    """Start the CLI interface"""
    try:
        # Clear the screen first
        os.system("cls" if os.name == "nt" else "clear")
        IoTMqttCli().cmdloop()
    except KeyboardInterrupt:
        print("\nExiting application...")
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        traceback.print_exc()  # This will print the full stack trace
        sys.exit(1)

if __name__ == "__main__":
    start_cli()