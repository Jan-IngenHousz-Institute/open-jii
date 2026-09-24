"""
Backend Client

Provides authenticated HTTP client for communicating with openJII backend API
from Databricks pipelines.
"""

import hashlib
import hmac
import json
import threading
import time
from collections import defaultdict, deque
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.parse import urljoin

import requests

# The chunk size the macro UDF posts in. Bound by what one sandbox invocation
# may emit, not by round trips. Every handler rejects a wrapper whose
# uncompressed stdout exceeds 10 MB, and that check runs before the response is
# compressed, so the consumer's larger decompressed ceiling never applies. The
# heaviest macro observed emits ~340 KB a row, which leaves room for about 30.
# The timeout is a whole-batch budget on the same invocation and caps at 60 s,
# so a larger chunk buys no more time. Raising this needs per-macro output
# sizing, not a larger constant.
DEFAULT_MACRO_BATCH_SIZE = 25

# Each request targets one macro/version group. Three concurrent requests per
# task give four production task slots twelve client requests in flight, leaving
# room beneath the sandbox's twenty reserved executions. Retries can outlive a
# failed request, so this is not a global bound on physical Lambda executions.
MACRO_REQUESTS_IN_FLIGHT = 3

# Seconds to wait before each retry of a macro request that failed transiently.
# A failed request writes a permanent error into every row it carried, so a
# backend restart or a throttled moment should not decide a measurement's result.
MACRO_REQUEST_RETRY_DELAYS = (1, 4)


class BackendIntegrationError(Exception):
    """Exception raised for backend integration errors."""

    pass


class TransientBackendError(BackendIntegrationError):
    """The backend was unreachable, timed out, throttled or answered with a 5xx."""


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

    # Keeps the request under the backend's 10 MB JSON body limit, so one
    # outsized sample fails alone instead of failing every item in its chunk.
    # It does not bound the Lambda invocation: the backend restores workbook
    # context after this point, which can copy each measurement again.
    MAX_BATCH_BYTES = 4 * 1024 * 1024

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
        # A requests.Session is not guaranteed to be thread-safe, and macro
        # requests are sent from several threads, so each thread gets its own.
        self._sessions = threading.local()
        # Lives as long as the client, so its threads keep their sessions and
        # connections from one UDF batch to the next.
        self._macro_requests = ThreadPoolExecutor(
            max_workers=MACRO_REQUESTS_IN_FLIGHT, thread_name_prefix="macro-request"
        )

    @property
    def session(self) -> requests.Session:
        session = getattr(self._sessions, "session", None)
        if session is None:
            session = requests.Session()
            self._sessions.session = session
        return session

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

        # A body that is not JSON will not parse on a retry either. Requests raises
        # this as a RequestException with no response, which would read as transient.
        except requests.exceptions.JSONDecodeError as e:
            raise BackendIntegrationError(f"Invalid JSON response: {e!s}") from e
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
            status = err_response.status_code if err_response is not None else None
            is_transient = status is None or status == 429 or status >= 500
            error_type = TransientBackendError if is_transient else BackendIntegrationError
            raise error_type(error_msg) from e

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

    def _chunk_items(
        self,
        items: list[dict[str, Any]],
        max_batch_size: int,
    ) -> Iterator[list[dict[str, Any]]]:
        """Yield request chunks bounded by both item count and serialized size.

        The caller supplies one macro/workbook-version group at a time. An
        item larger than the budget still goes out alone, so the backend
        rejects that one row rather than the pipeline dropping it.
        """
        batch: list[dict[str, Any]] = []
        # The envelope and the commas joining the items are part of the body.
        envelope_bytes = len(json.dumps({"items": [], "timeout": 0}, separators=(",", ":")))
        batch_bytes = envelope_bytes

        for item in items:
            # Measured the way the body is built, or the budget bounds nothing.
            item_bytes = len(json.dumps(item, separators=(",", ":"))) + 1
            is_full = len(batch) >= max_batch_size or batch_bytes + item_bytes > self.MAX_BATCH_BYTES

            if batch and is_full:
                yield batch
                batch = []
                batch_bytes = envelope_bytes

            batch.append(item)
            batch_bytes += item_bytes

        if batch:
            yield batch

    def execute_macro_batch(
        self,
        items: list[dict[str, Any]],
        timeout: int = 30,
        max_batch_size: int = DEFAULT_MACRO_BATCH_SIZE,
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
            max_batch_size: Max items per HTTP request. Also bounded by
                MAX_BATCH_BYTES, and by what one sandbox invocation may emit.

        Returns:
            Dict with 'results' list and optional 'errors' list.
            Each result: {id, macro_id, success, output?, error?}

        Raises:
            BackendIntegrationError: If the request fails.
        """
        if not items:
            return {"results": []}

        if max_batch_size < 1:
            raise ValueError("max_batch_size must be at least 1")

        # One group per request bounds backend fan-out even with overlapping
        # requests. Source positions distinguish duplicate ids across versions,
        # which the backend does not include in its response keys.
        groups: dict[tuple[str, str], list[tuple[int, dict[str, Any]]]] = {}
        for index, item in enumerate(items):
            key = (item.get("macro_id") or "", item.get("workbook_version_id") or "")
            groups.setdefault(key, []).append((index, item))
        batches = []
        for group in groups.values():
            start = 0
            for chunk in self._chunk_items([item for _, item in group], max_batch_size):
                batches.append(group[start : start + len(chunk)])
                start += len(chunk)

        def execute(batch):
            results, errors = self._execute_macro_chunk([item for _, item in batch], timeout)
            if len(results) != len(batch):
                print(
                    "[BackendClient] Macro batch response cardinality mismatch: "
                    f"expected {len(batch)} results, received {len(results)}"
                )
            positions: dict[tuple[Any, Any], deque[int]] = defaultdict(deque)
            for index, item in batch:
                positions[(item.get("id"), item.get("macro_id"))].append(index)
            indexed_results = []
            unexpected_results = 0
            for result in results:
                key = (result.get("id"), result.get("macro_id"))
                if positions.get(key):
                    indexed_results.append((positions[key].popleft(), result))
                else:
                    unexpected_results += 1
            if unexpected_results:
                print(f"[BackendClient] Unexpected macro result keys: {unexpected_results}")
            # Missing entries must occupy their original positions; otherwise a
            # later duplicate could consume another workbook version's result.
            for index, item in batch:
                key = (item.get("id"), item.get("macro_id"))
                if index in positions[key]:
                    indexed_results.append(
                        (
                            index,
                            {
                                "id": item.get("id"),
                                "macro_id": item.get("macro_id"),
                                "success": False,
                                "error": "No result returned for item " + str(item.get("id")),
                            },
                        )
                    )
            return indexed_results, errors

        if len(batches) == 1:
            outcomes = [execute(batches[0])]
        else:
            outcomes = list(self._macro_requests.map(execute, batches))
        indexed_results = [result for results, _ in outcomes for result in results]
        all_results = [result for _, result in sorted(indexed_results, key=lambda pair: pair[0])]
        all_errors = [error for _, errors in outcomes for error in errors]

        response: dict[str, Any] = {"results": all_results}
        if all_errors:
            response["errors"] = all_errors
        return response

    def _execute_macro_chunk(
        self, batch: list[dict[str, Any]], timeout: int
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """One request's results and errors. A failed request fails only its own items,
        once any transient failure has been retried."""
        payload = {"items": batch, "timeout": timeout}

        try:
            result = self._make_request_with_retries(self.WEBHOOK_MACRO_BATCH_PATH, payload)
            return result.get("results", []), result.get("errors") or []
        except BackendIntegrationError as e:
            # Don't lose other chunks: synthesize per-item failure entries
            # so the caller can map them back via (id, macro_id). A transient
            # 5xx on one chunk shouldn't take down the rest of the partition.
            chunk_error = f"Chunk failed: {str(e)[:500]}"
            failures = [
                {
                    "id": item.get("id"),
                    "macro_id": item.get("macro_id"),
                    "success": False,
                    "error": chunk_error,
                }
                for item in batch
            ]
            return failures, [chunk_error]
        except Exception as e:
            raise BackendIntegrationError(f"Unexpected error in macro batch execution: {e!s}") from e

    def _make_request_with_retries(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        """``_make_request``, tried again after each transient failure."""
        for delay in MACRO_REQUEST_RETRY_DELAYS:
            try:
                return self._make_request(endpoint, payload)
            except TransientBackendError as error:
                print(f"[BackendClient] Retrying in {delay} s after a transient failure: {error!s}")
                time.sleep(delay)

        return self._make_request(endpoint, payload)
