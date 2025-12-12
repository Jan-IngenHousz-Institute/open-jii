# Common Issues

This document lists common issues you might encounter while using the MultispeQ MQTT Interface tool and provides guidance on how to resolve them.

## Connection Issues

### Unable to Connect to AWS IoT Core

**Symptoms**:

- Connection attempts fail
- Error messages indicating network or authentication issues

**Possible Causes**:

- Incorrect AWS IoT Core endpoint
- Network connectivity issues
- Invalid or missing certificates

**Solutions**:

- Verify the `AWS_IOT_ENDPOINT` environment variable is set correctly
- Check your network connection and firewall settings
- Ensure your certificates are valid and correctly configured

### Connection Drops Frequently

**Symptoms**:

- Connection is established but drops frequently
- Error messages indicating connection interruptions

**Possible Causes**:

- Unstable network connection
- Incorrect keep-alive settings

**Solutions**:

- Check your network stability
- Adjust the `AWS_IOT_KEEP_ALIVE` setting to a higher value

## Authentication Errors

### Invalid Certificate

**Symptoms**:

- Error messages indicating invalid or expired certificates

**Possible Causes**:

- Certificates are expired or not valid
- Incorrect certificate paths

**Solutions**:

- Verify the certificate paths and ensure they are correct
- Check the validity of your certificates using `openssl`

### Access Denied

**Symptoms**:

- Error messages indicating access is denied

**Possible Causes**:

- Incorrect AWS IoT Core policies
- Insufficient permissions

**Solutions**:

- Review and update your AWS IoT Core policies to ensure they allow the required actions
- Verify that your IAM role has the necessary permissions

## Device Connection Issues

### Device Not Found

**Symptoms**:

- No available ports found
- Unable to connect to the MultispeQ device

**Possible Causes**:

- Device is not properly connected
- Incorrect port selection

**Solutions**:

- Ensure the device is properly connected and powered on
- Verify the correct port is selected

### Measurement Errors

**Symptoms**:

- Errors during measurement
- Incomplete or incorrect data

**Possible Causes**:

- Device malfunction
- Incorrect measurement protocol

**Solutions**:

- Check the device for any hardware issues
- Verify the measurement protocol is correctly defined

## Message Publishing Issues

### Failed to Publish Message

**Symptoms**:

- Error messages indicating message publishing failures

**Possible Causes**:

- Incorrect topic configuration
- Network issues

**Solutions**:

- Verify the topic configuration is correct
- Check your network connection

### Message Format Errors

**Symptoms**:

- Error messages indicating invalid message format

**Possible Causes**:

- Incorrect message payload structure
- Missing required fields

**Solutions**:

- Ensure the message payload adheres to the expected format
- Validate the message using a JSON schema validation tool

## General Troubleshooting Tips

- **Enable Debug Logging**: Set the `AWS_LOG_LEVEL` environment variable to `DEBUG` to get detailed logs.
- **Check Configuration**: Use the `config` command to display the current configuration and verify all settings.
- **Review Logs**: Check the logs for detailed error messages and stack traces.
- **Consult Documentation**: Refer to the [openJII Documentation Hub](https://docs.openjii.org) for additional guidance.

By following these guidelines, you can resolve common issues and ensure smooth operation of the MultispeQ MQTT Interface tool.
