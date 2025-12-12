# Basic Usage

The MultispeQ MQTT Interface provides a command-line tool for connecting MultispeQ devices to the openJII platform via MQTT. This guide covers the basic operations you'll need to get started.

## Starting the Tool

After installation, start the MultispeQ MQTT Interface by running:

```bash
mmi
```

This will launch the command-line interface with a menu of available commands.

## Basic Command Flow

A typical workflow involves the following steps:

1. **Connect to AWS IoT Core**
2. **Connect to a MultispeQ device**
3. **Take measurements and publish data**
4. **Disconnect when finished**

## Key Commands

### Connecting to AWS IoT Core

```bash
MultispeQ > connect

# Or use the shortcut
MultispeQ > c
```

You'll be prompted to provide:

- Experiment ID
- Protocol ID
- Certificate information (ID and directory path)

The certificate directory should contain:

- `<cert_id>-certificate.pem.crt`
- `<cert_id>-private.pem.key`
- `root-CA.pem`

### Checking Connection Status

```bash
MultispeQ > status

# Or use the shortcut
MultispeQ > s
```

This will display your connection status, endpoint, client ID, and topic information.

### Connecting to a Device

```bash
MultispeQ > connect_device

# Or use the shortcut
MultispeQ > v
```

You'll be prompted to select from available MultispeQ devices connected to your computer.

### Taking Measurements & Publishing Data

```bash
MultispeQ > publish

# Or use the shortcut
MultispeQ > m
```

This command will:

1. Take measurements using the connected MultispeQ device
2. Format the data according to the openJII data model
3. Publish the measurements to AWS IoT Core using your configured topic

### Viewing Current Configuration

```bash
MultispeQ > config

# Or use the shortcut
MultispeQ > f
```

This displays your current configuration settings, including endpoint, certificates, and topic information.

### Setting Topic Parameters

```bash
MultispeQ > set_topic

# Or use the shortcut
MultispeQ > t
```

This allows you to update the experiment ID and protocol ID for your MQTT topic.

### Testing Connection

```bash
MultispeQ > ping

# Or use the shortcut
MultispeQ > p
```

Tests connectivity to the AWS IoT Core endpoint.

### Disconnecting

```bash
MultispeQ > disconnect

# Or use the shortcut
MultispeQ > d
```

Properly terminates the connection to AWS IoT Core.

### Exiting the Application

```bash
MultispeQ > exit

# Or use these shortcuts
MultispeQ > quit
MultispeQ > q
```

Disconnects any active connections and exits the application.

## Topic Structure

The MQTT topic follows this structure:

```code
experiment/data_ingest/v1/{experiment_id}/{sensor_family}/{sensor_version}/{sensor_id}/{protocol_id}
```

For example:

```code
experiment/data_ingest/v1/greenhouse-2023/multispeq/v1.0/device123/photosynthesis
```

## Troubleshooting Tips

- **Connection Issues**: Verify certificate paths and AWS IoT Core endpoint
- **Authentication Errors**: Check that your certificates are valid and correctly configured
- **Device Not Found**: Ensure your MultispeQ device is properly connected and detected
- **Publish Failures**: Verify your AWS IoT Core policies allow publishing to your topic
