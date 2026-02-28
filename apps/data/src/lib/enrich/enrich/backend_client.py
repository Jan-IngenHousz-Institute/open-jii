"""
Backend Client

Provides authenticated HTTP client for communicating with openJII backend API
from Databricks pipelines.
"""

import hashlib
import hmac
import json
import time
from typing import Dict, Any, List, Optional
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
    
    def __init__(self, base_url: str, api_key_id: str, webhook_secret: str, timeout: int = 30):
        """
        Initialize the backend client.
        
        Args:
            base_url: Base URL of the openJII backend API
            api_key_id: API key ID for authentication
            webhook_secret: Secret for HMAC signature generation
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.webhook_path = "/api/v1/users/metadata"
        self.api_key_id = api_key_id
        self.webhook_secret = webhook_secret
        self.timeout = timeout
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create HTTP session for making requests."""
        return requests.Session()
        
    def _create_hmac_signature(self, payload: Dict[str, Any], timestamp: int) -> str:
        """
        Create HMAC signature for request authentication.
        
        Args:
            payload: The payload to sign
            timestamp: Unix timestamp in seconds
            
        Returns:
            HMAC SHA256 signature as hex string
        """
        # Create canonical JSON string (sorted keys, compact representation)
        canonical_payload = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        
        # Create payload string with timestamp prefix as required by the backend
        message = f"{timestamp}:{canonical_payload}"
        
        # Create HMAC signature using SHA-256
        signature = hmac.new(
            key=self.webhook_secret.encode('utf-8'),
            msg=message.encode('utf-8'),
            digestmod=hashlib.sha256
        ).hexdigest()
        
        return signature
        
    def _make_request(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
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
            "x-databricks-timestamp": str(timestamp)
        }
        
        # Make request
        url = urljoin(f"{self.base_url}/", endpoint.lstrip('/'))
        
        try:
            # Use canonical JSON in the actual request to ensure signature matches
            canonical_payload = json.dumps(payload, sort_keys=True, separators=(',', ':'))

            # Use data with explicit content-type to ensure the exact canonical format is preserved
            response = self.session.post(
                url,
                data=canonical_payload,
                headers=headers,
                timeout=self.timeout
            )
            
            response.raise_for_status()
            
            if response.status_code in (200, 201):
                result = response.json()
                if result.get('success', False):
                    return result
                else:
                    raise BackendIntegrationError(f"API returned success=false: {result}")
            else:
                raise BackendIntegrationError(
                    f"API request failed with status {response.status_code}: {response.text}"
                )
                
        except requests.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            if hasattr(e, 'response') and e.response:
                error_msg += f" | Response status: {e.response.status_code} | Response body: {e.response.text}"
            raise BackendIntegrationError(error_msg)
            
    def get_user_metadata(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
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
        if len(user_ids) > 100:
            raise BackendIntegrationError(f"Too many user IDs in batch: {len(user_ids)} (max 100)")
            
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
            raise BackendIntegrationError(f"Unexpected error fetching user metadata: {str(e)}")
        
        # Convert list to dictionary for easier lookup
        user_metadata = {}
        users_list = result.get('users', [])
        
        if not isinstance(users_list, list):
            raise BackendIntegrationError(f"Invalid response format: expected 'users' to be a list, got {type(users_list)}")
        
        for user in users_list:
            if not isinstance(user, dict) or 'userId' not in user:
                continue  # Skip malformed user entries
                
            user_metadata[user['userId']] = {
                'firstName': user.get('firstName'),
                'lastName': user.get('lastName'),
                'avatarUrl': user.get('avatarUrl')
            }
            
        return user_metadata


