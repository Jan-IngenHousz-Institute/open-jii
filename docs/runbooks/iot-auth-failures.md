# iot-auth-failures

Devices failing to connect or authenticate to IoT Core.

Likely causes: expired/revoked certificate on a device batch; policy not attached after registration; clock skew on device breaking TLS; a device stuck mid-rotation.

First moves: split Connect.AuthError vs ClientError in the Ingest dashboard; correlate with iot_devices rows in status pending/rotating/revoked; check cert-expiry-horizon roster.
