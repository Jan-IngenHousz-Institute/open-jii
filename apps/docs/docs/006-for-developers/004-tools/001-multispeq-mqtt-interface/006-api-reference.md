# MMI API Reference

This document provides a comprehensive reference for the commands and options available in the MultispeQ MQTT Interface tool.

## Command Reference

### `connect`

**Description**: Connect to AWS IoT Core MQTT broker.

**Usage**:

```bash
connect

# Or use the shortcut
c
```

**Prompts**:

- Experiment ID
- Protocol ID
- Certificate information (ID and directory path)

### `disconnect`

**Description**: Disconnect from AWS IoT Core MQTT broker.

**Usage**:

```bash
disconnect

# Or use the shortcut
d
```

### `ping`

**Description**: Test the connection to AWS IoT Core.

**Usage**:

```bash
ping

# Or use the shortcut
p
```

### `publish`

**Description**: Measure and publish a message to the configured topic.

**Usage**:

```bash
publish
# Or use the shortcut
m
```

### `status`

**Description**: Display the current connection status.

**Usage**:

```bash
status

# Or use the shortcut
s
```

### `config`

**Description**: Display the current configuration.

**Usage**:

```bash
config

# Or use the shortcut
f
```

### `set_topic`

**Description**: Set the experiment ID and protocol ID for the MQTT topic.

**Usage**:

```bash
set_topic

# Or use the shortcut
t
```

### `connect_device`

**Description**: Connect to a device from a selected port.

**Usage**:

```bash
connect_device

# Or use the shortcut
v
```

### `exit`

**Description**: Exit the application gracefully.

**Usage**:

```bash
exit

# Or use the shortcuts
quit
q
```

### `clear`

**Description**: Clear the screen.

**Usage**:

```bash
clear
```

## Options (In development)

### `--debug`

**Description**: Enable debug mode for detailed output and logs.

**Usage**:

```bash
mmi --debug
```

## Environment Variables

### Core Settings

| Variable           | Description                   | Default Value                                     |
| ------------------ | ----------------------------- | ------------------------------------------------- |
| `AWS_IOT_ENDPOINT` | AWS IoT Core endpoint address | a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com |
| `AWS_REGION`       | AWS region                    | eu-central-1                                      |
| `AWS_IOT_PORT`     | MQTT connection port          | 8883                                              |

### Authentication

| Variable                       | Description                | Default Value |
| ------------------------------ | -------------------------- | ------------- |
| `AWS_IOT_CERT_FILEPATH`        | Path to client certificate | None          |
| `AWS_IOT_PRIVATE_KEY_FILEPATH` | Path to private key        | None          |
| `AWS_IOT_CA_FILEPATH`          | Path to CA certificate     | None          |

### Connection Settings

| Variable                | Description                    | Default Value         |
| ----------------------- | ------------------------------ | --------------------- |
| `AWS_IOT_CLIENT_ID`     | Client identifier              | "test-" + random UUID |
| `AWS_IOT_KEEP_ALIVE`    | Keep-alive interval in seconds | 30                    |
| `AWS_IOT_CLEAN_SESSION` | Whether to use clean sessions  | False                 |

### Topic Structure

| Variable        | Description        | Default Value                                                                               |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `AWS_IOT_TOPIC` | MQTT topic pattern | `experiment/data_ingest/v1/{experiment_id}/multispeq/v1.0/cli_test_sensor_id/{protocol_id}` |

### Proxy Configuration

| Variable             | Description         | Default Value |
| -------------------- | ------------------- | ------------- |
| `AWS_IOT_PROXY_HOST` | HTTP proxy hostname | None          |
| `AWS_IOT_PROXY_PORT` | HTTP proxy port     | 0             |
