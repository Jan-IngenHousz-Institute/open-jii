# Topic Structure

This document describes the MQTT topic structure used by the MultispeQ MQTT Interface tool. Understanding the topic structure is essential for configuring the tool and integrating it with the openJII platform.

## Topic Hierarchy

The MQTT topic hierarchy follows a structured pattern to ensure data is organized and easily accessible. The default topic structure is:

```code
experiment/data_ingest/v1/{experiment_id}/{sensor_family}/{sensor_version}/{sensor_id}/{protocol_id}
```

### Topic Components

- **experiment_id**: Identifier for the experiment. This allows grouping data by specific experiments.
- **sensor_family**: The type of sensor being used. For the MultispeQ tool, this is always "multispeq".
- **sensor_version**: The version of the sensor. The default is "v1.0".
- **sensor_id**: Unique identifier for the sensor device. This helps in distinguishing data from different devices.
- **protocol_id**: Identifier for the measurement protocol. This allows differentiation between various measurement protocols.

### Example Topic

For an experiment with ID "greenhouse-2023", using a MultispeQ sensor with ID "device123" and protocol "photosynthesis", the topic would be:

```code
experiment/data_ingest/v1/greenhouse-2023/multispeq/v1.0/device123/photosynthesis
```

## Customizing the Topic Structure

You can customize the topic structure to fit your specific requirements. This can be done by setting the `AWS_IOT_TOPIC` environment variable or using the `set_topic` command in the CLI.

### Setting the Topic via Environment Variable

```bash
export AWS_IOT_TOPIC="experiment/data_ingest/v1/{experiment_id}/{sensor_family}/{sensor_version}/{sensor_id}/{protocol_id}"
```

### Updating the Topic at Runtime

You can update the topic parameters at runtime using the `set_topic` command:

```bash
MultispeQ > set_topic
```

You will be prompted to enter the new experiment ID and protocol ID.

## Subscription Patterns

To subscribe to all messages from a specific experiment, you can use the following pattern:

```code
experiment/data_ingest/v1/{experiment_id}/#
```

For example, to subscribe to all messages from the "greenhouse-2023" experiment:

```code
experiment/data_ingest/v1/greenhouse-2023/#
```

## Best Practices

- **Use Descriptive Identifiers**: Ensure that your experiment IDs, sensor IDs, and protocol IDs are descriptive and unique.
- **Follow Naming Conventions**: Stick to a consistent naming convention to make it easier to manage and query your data.
- **Wildcard Subscriptions**: Use MQTT wildcards (`+` and `#`) to subscribe to multiple topics efficiently.

## Troubleshooting

### Common Issues

- **Invalid Topic Format**: Ensure that your topic follows the correct structure and includes all required components.
- **Subscription Failures**: Verify that your MQTT client has the necessary permissions to subscribe to the desired topics.

### Debugging Tips

- **Check Topic Configuration**: Use the `config` command to display the current topic configuration.
- **Log Messages**: Enable verbose logging to see detailed information about published and subscribed messages.

By following these guidelines, you can effectively manage and utilize the MQTT topic structure for the MultispeQ MQTT Interface tool.
