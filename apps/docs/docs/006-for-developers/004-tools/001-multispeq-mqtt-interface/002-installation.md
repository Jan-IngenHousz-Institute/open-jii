# Installation Guide

This guide provides detailed instructions for installing the MultispeQ MQTT Interface tool, which enables interaction with MultispeQ devices through MQTT protocol.

## Prerequisites

Before installation, ensure you have:

- Python 3.8 or higher
- Pip package manager
- Git (for cloning the repository)
- An active internet connection

## Installation Options

### Option 1: Direct Installation (For Users)

Install directly from GitHub using pip:

```bash
# Install directly from GitHub
pip install git+https://github.com/Jan-IngenHousz-Institute/open-jii.git#subdirectory=apps/tools/multispeq_mqtt_interface
```

This will install the latest version of the interface along with all required dependencies.

### Option 2: Development Installation (For Developers)

For contributors who want to modify the code:

```bash
# Clone the repository
git clone https://github.com/Jan-IngenHousz-Institute/open-jii.git

# Navigate to the tool directory
cd open-jii/apps/tools/multispeq_mqtt_interface

# Install in development mode
pip install -e .
```

The `-e` flag installs the package in "editable" mode, allowing you to modify the source code without reinstalling.

## Verifying Installation

Verify that the installation was successful by running:

```bash
mmi
```

This should start the CLI tool.

## Creating a Virtual Environment (Optional)

You may want to use a Python virtual environment:

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate

# Now proceed with installation
pip install git+https://github.com/Jan-IngenHousz-Institute/open-jii.git#subdirectory=apps/tools/multispeq_mqtt_interface
```

## Next Steps

After installation, proceed to the **[Basic Usage](./003-usage/001-basic-usage.md)** guide to learn how to use the MultispeQ MQTT Interface.

## Troubleshooting

If you encounter installation issues:

1. **Dependency Errors**: Ensure your Python version is compatible (3.8+)
2. **Permission Issues**: Try using `pip` with `--user` flag or use `sudo` (on Linux/macOS)
3. **Git Issues**: Verify that Git is installed correctly

For persistent problems, please **[open an issue](https://github.com/Jan-IngenHousz-Institute/open-jii/issues)** on GitHub.
