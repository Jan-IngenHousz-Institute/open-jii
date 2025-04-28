# Configuration

This document explains the configuration options available for the MultispeQ MQTT Interface tool and how to customize them for your environment.

## Configuration Methods

The MultispeQ MQTT Interface can be configured in several ways, listed here in order of precedence:

1. Command-line arguments (when available)
2. Environment variables
3. Interactive prompts
4. Default values

## Environment Variables

Environment variables provide a convenient way to configure the tool, especially in automated or scripted environments.

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

| Variable        | Description        | Default Value                                                                                 |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `AWS_IOT_TOPIC` | MQTT topic pattern | experiment/data_ingest/v1/\{experiment_id\}/multispeq/v1.0/cli_test_sensor_id/\{protocol_id\} |

### Proxy Configuration

| Variable             | Description         | Default Value |
| -------------------- | ------------------- | ------------- |
| `AWS_IOT_PROXY_HOST` | HTTP proxy hostname | None          |
| `AWS_IOT_PROXY_PORT` | HTTP proxy port     | 0             |

## Command-Line Arguments

Currently, the tool does not support command-line arguments for configuration. All configuration is handled through environment variables or interactive prompts.

## Using a .env File

You can create a `.env` file in your working directory to store configuration variables. The tool will automatically load these values when started.

Example `.env` file:

```bash
AWS_IOT_ENDPOINT=a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com
AWS_IOT_CERT_FILEPATH=/path/to/certificate.pem.crt
AWS_IOT_PRIVATE_KEY_FILEPATH=/path/to/private.pem.key
AWS_IOT_CA_FILEPATH=/path/to/root-CA.pem
AWS_IOT_CLIENT_ID=my-multispeq-device
AWS_IOT_TOPIC=experiment/data_ingest/v1/greenhouse-2023/multispeq/v1.0/device123/photosynthesis
```

## Configuration Storage

The tool does not currently persist configuration between sessions. You will need to provide configuration details each time you run the tool, or use environment variables or a `.env` file.

## Certificate Requirements

AWS IoT Core requires X.509 certificates for device authentication. Your certificate files should have the following naming convention:

- Client certificate: `<certificate_id>-certificate.pem.crt`
- Private key: `<certificate_id>-private.pem.key`
- Root CA certificate: `root-CA.pem`

## Topic Structure Conventions

The default topic structure follows this pattern:

```code
experiment/data_ingest/v1/{experiment_id}/{sensor_family}/{sensor_version}/{sensor_id}/{protocol_id}
```

Where:

- `{experiment_id}`: Identifier for your experiment
- `{sensor_family}`: Always "multispeq" for this tool
- `{sensor_version}`: Version of the sensor (default: "v1.0")
- `{sensor_id}`: Unique identifier for the sensor device
- `{protocol_id}`: Identifier for the measurement protocol

## Configuration Validation

The tool validates your configuration before attempting to connect:

1. Certificate files existence and permissions
2. Endpoint format
3. Topic structure
4. Connection parameters

Any validation errors will be displayed with guidance on how to correct them.

## Example Configuration for Common Scenarios

### Basic Local Development

```bash
export AWS_IOT_ENDPOINT=a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com
export AWS_IOT_CERT_FILEPATH=~/.aws-iot-certificates/certificate.pem.crt
export AWS_IOT_PRIVATE_KEY_FILEPATH=~/.aws-iot-certificates/private.pem.key
export AWS_IOT_CA_FILEPATH=~/.aws-iot-certificates/root-CA.pem
```

### Behind a Corporate Proxy

```bash
export AWS_IOT_ENDPOINT=a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com
export AWS_IOT_CERT_FILEPATH=~/.aws-iot-certificates/certificate.pem.crt
export AWS_IOT_PRIVATE_KEY_FILEPATH=~/.aws-iot-certificates/private.pem.key
export AWS_IOT_CA_FILEPATH=~/.aws-iot-certificates/root-CA.pem
export AWS_IOT_PROXY_HOST=proxy.company.com
export AWS_IOT_PROXY_PORT=8080
```

### Automated Data Collection

```bash
export AWS_IOT_ENDPOINT=a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com
export AWS_IOT_CERT_FILEPATH=~/.aws-iot-certificates/certificate.pem.crt
export AWS_IOT_PRIVATE_KEY_FILEPATH=~/.aws-iot-certificates/private.pem.key
export AWS_IOT_CA_FILEPATH=~/.aws-iot-certificates/root-CA.pem
export AWS_IOT_CLIENT_ID=automated-device-$(hostname)
export AWS_IOT_TOPIC=experiment/data_ingest/v1/greenhouse-monitoring/multispeq/v1.0/$(hostname)/hourly-scan
```
