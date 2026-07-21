"""
Backend Client

Provides authenticated HTTP client for communicating with openJII backend API
from Databricks pipelines.
"""

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import urljoin

import requests


class BackendIntegrationError(Exception):
    """Exception raised for backend integration errors."""

    pass


class BackendClient:
    """
    Authenticated HTTP client for openJII backend API with HMAC authentication.

    Handles HMAC signature generation and provides convenient methods for
    common backend operations from Databricks pipelines.

    Features:
    - HMAC SHA-256 authentication
    - Canonical JSON payload signing
    - Session management with connection pooling
    """

    WEBHOOK_USER_METADATA_PATH = "/api/v1/users/metadata"
    WEBHOOK_MACRO_BATCH_PATH = "/api/v1/macros/execute-batch"
    WEBHOOK_IOT_REGISTRY_PATH = "/api/v1/iot/devices/registry"

    def __init__(self, base_url: str, api_key_id: str, webhook_secret: str, timeout: int = 30):
        """
        Initialize the backend client.

        Args:
            base_url: Base URL of the openJII backend API
            api_key_id: API key ID for authentication
            webhook_secret: Secret for HMAC signature generation
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.webhook_path = self.WEBHOOK_USER_METADATA_PATH
        self.api_key_id = api_key_id
        self.webhook_secret = webhook_secret
        self.timeout = timeout
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Create HTTP session for making requests."""
        return requests.Session()

    def _create_hmac_signature(self, payload: dict[str, Any], timestamp: int) -> str:
        """
        Create HMAC signature for request authentication.

        Args:
            payload: The payload to sign
            timestamp: Unix timestamp in seconds

        Returns:
            HMAC SHA256 signature as hex string
        """
        # ensure_ascii=False so non-ASCII chars (e.g. U+FEFF BOM) are output as
        # raw UTF-8, matching JavaScript JSON.stringify which does not escape them.
        canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        # Create payload string with timestamp prefix as required by the backend
        message = f"{timestamp}:{canonical_payload}"

        # Create HMAC signature using SHA-256
        signature = hmac.new(
            key=self.webhook_secret.encode("utf-8"), msg=message.encode("utf-8"), digestmod=hashlib.sha256
        ).hexdigest()

        return signature

    def _make_request(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Make authenticated request to backend API.

        Args:
            endpoint: API endpoint path
            payload: Request payload

        Returns:
            Response JSON data

        Raises:
            BackendIntegrationError: If request fails or returns error
        """
        # Create timestamp for request (seconds since epoch)
        timestamp = int(time.time())

        # Create HMAC signature
        signature = self._create_hmac_signature(payload, timestamp)

        # Set up headers with HMAC authentication
        headers = {
            "Content-Type": "application/json",
            "x-api-key-id": self.api_key_id,
            "x-databricks-signature": signature,
            "x-databricks-timestamp": str(timestamp),
        }

        # Make request
        url = urljoin(f"{self.base_url}/", endpoint.lstrip("/"))

        try:
            # Use canonical JSON in the actual request to ensure signature matches
            canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"))

            # Use data with explicit content-type to ensure the exact canonical format is preserved
            response = self.session.post(url, data=canonical_payload, headers=headers, timeout=self.timeout)

            response.raise_for_status()

            if response.status_code in (200, 201):
                result = response.json()
                if not result.get("success", False):
                    raise BackendIntegrationError(
                        f"API returned error: {result.get('message', 'Unknown error')}"
                    )
                return result
            else:
                raise BackendIntegrationError(
                    f"API request failed with status {response.status_code}: {response.text}"
                )

        except requests.RequestException as e:
            error_msg = f"Request failed: {e!s}"
            # bool(Response) is False for 4xx/5xx: must use `is not None` here.
            err_response = getattr(e, "response", None)
            if err_response is not None:
                error_msg += f" | Response status: {err_response.status_code}"
                # Body goes to executor logs for diagnosis, not into error_msg
                # since that propagates into the Delta `macro_error` column.
                body = (err_response.text or "")[:2000]
                if body:
                    print(f"[BackendClient] HTTP {err_response.status_code} body: {body}")
            raise BackendIntegrationError(error_msg) from e

    def get_user_metadata(self, user_ids: list[str]) -> dict[str, dict[str, Any]]:
        """
        Fetch user metadata for multiple user IDs with robust error handling.

        Args:
            user_ids: List of user IDs to fetch metadata for

        Returns:
            Dictionary mapping user_id to user metadata

        Raises:
            BackendIntegrationError: If request fails or validation errors occur
        """
        if not user_ids:
            return {}

        # Validate input
        if not isinstance(user_ids, list):
            raise BackendIntegrationError("user_ids must be a list")

        # Limit batch size to avoid API limits
        if len(user_ids) > 500:
            raise BackendIntegrationError(f"Too many user IDs in batch: {len(user_ids)} (max 500)")

        # Filter out None/empty values
        valid_user_ids = [uid for uid in user_ids if uid is not None and str(uid).strip()]
        if not valid_user_ids:
            return {}

        payload = {"userIds": valid_user_ids}

        try:
            result = self._make_request(self.webhook_path, payload)
        except BackendIntegrationError:
            # Re-raise BackendIntegrationError as-is
            raise
        except Exception as e:
            # Wrap other exceptions
            raise BackendIntegrationError(f"Unexpected error fetching user metadata: {e!s}") from e

        # Convert list to dictionary for easier lookup
        user_metadata = {}
        users_list = result.get("users", [])

        if not isinstance(users_list, list):
            raise BackendIntegrationError(
                f"Invalid response format: expected 'users' to be a list, got {type(users_list)}"
            )

        for user in users_list:
            if not isinstance(user, dict) or "userId" not in user:
                continue  # Skip malformed user entries

            user_metadata[user["userId"]] = {
                "firstName": user.get("firstName"),
                "lastName": user.get("lastName"),
                "avatarUrl": user.get("avatarUrl"),
            }

        return user_metadata

    def get_device_registry(self, thing_names: list[str]) -> dict[str, dict[str, Any]]:
        """
        Resolve broker-authenticated client ids to their device registry rows.

        For an X.509 device the MQTT client id equals its Thing name, so the
        pipeline passes distinct client_id values here; Cognito/mobile client ids
        match no registry row and are simply absent from the result.

        Returns:
            Dict mapping thing_name -> {id, serialNumber, deviceType, status, createdBy}
        """
        if not thing_names:
            return {}
        if not isinstance(thing_names, list):
            raise BackendIntegrationError("thing_names must be a list")
        if len(thing_names) > 500:
            raise BackendIntegrationError(f"Too many thing names in batch: {len(thing_names)} (max 500)")

        valid = [t for t in thing_names if t is not None and str(t).strip()]
        if not valid:
            return {}

        payload = {"thingNames": valid}

        try:
            result = self._make_request(self.WEBHOOK_IOT_REGISTRY_PATH, payload)
        except BackendIntegrationError:
            raise
        except Exception as e:
            raise BackendIntegrationError(f"Unexpected error fetching device registry: {e!s}") from e

        registry: dict[str, dict[str, Any]] = {}
        devices_list = result.get("devices", [])

        if not isinstance(devices_list, list):
            raise BackendIntegrationError(
                f"Invalid response format: expected 'devices' to be a list, got {type(devices_list)}"
            )

        for device in devices_list:
            if not isinstance(device, dict) or "thingName" not in device:
                continue
            registry[device["thingName"]] = {
                "id": device.get("id"),
                "serialNumber": device.get("serialNumber"),
                "deviceType": device.get("deviceType"),
                "status": device.get("status"),
                "createdBy": device.get("createdBy"),
            }

        return registry

    def execute_macro_batch(
        self,
        items: list[dict[str, Any]],
        timeout: int = 30,
        max_batch_size: int = 500,
    ) -> dict[str, Any]:
        """
        Execute macros via the backend batch endpoint.

        The backend groups items by macro_id + workbook_version_id, resolves
        published snapshots (or the live macro for legacy items), fans out
        Lambda invocations, and returns results.

        Args:
            items: Dicts with id, macro_id, data, and optional
                workbook_version_id/context.
            timeout: Per-Lambda timeout in seconds (1-60).
            max_batch_size: Max items per HTTP request (default 500, API limit 5000).

        Returns:
            Dict with 'results' list and optional 'errors' list.
            Each result: {id, macro_id, success, output?, error?}

        Raises:
            BackendIntegrationError: If the request fails.
        """
        if not items:
            return {"results": []}

        # Keep each HTTP chunk as homogeneous as possible. A macro UUID may
        # point at different immutable code across workbook versions.
        sorted_items = sorted(
            items,
            key=lambda item: (
                item.get("macro_id") or "",
                item.get("workbook_version_id") or "",
            ),
        )

        all_results: list[dict[str, Any]] = []
        all_errors: list[str] = []

        # Chunk into batches to avoid payload size limits
        for i in range(0, len(sorted_items), max_batch_size):
            batch = sorted_items[i : i + max_batch_size]
            payload = {"items": batch, "timeout": timeout}

            try:
                result = self._make_request(self.WEBHOOK_MACRO_BATCH_PATH, payload)
                all_results.extend(result.get("results", []))
                batch_errors = result.get("errors", [])
                if batch_errors:
                    all_errors.extend(batch_errors)
            except BackendIntegrationError as e:
                # Don't lose other chunks: synthesize per-item failure entries
                # so the caller can map them back via (id, macro_id), and keep
                # iterating. A transient 5xx on one chunk shouldn't take down
                # the rest of the partition.
                chunk_error = f"Chunk failed: {str(e)[:500]}"
                for item in batch:
                    all_results.append(
                        {
                            "id": item.get("id"),
                            "macro_id": item.get("macro_id"),
                            "success": False,
                            "error": chunk_error,
                        }
                    )
                all_errors.append(chunk_error)
            except Exception as e:
                raise BackendIntegrationError(f"Unexpected error in macro batch execution: {e!s}") from e

        response: dict[str, Any] = {"results": all_results}
        if all_errors:
            response["errors"] = all_errors
        return response
