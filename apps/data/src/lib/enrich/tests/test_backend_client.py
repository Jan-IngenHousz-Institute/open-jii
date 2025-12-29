"""
Tests for enrich backend client
"""
import pytest
from unittest.mock import Mock, patch

from enrich.backend_client import BackendClient, BackendIntegrationError


class TestBackendClient:
    """Test backend client functionality"""
    
    def test_backend_client_initialization(self):
        """Test BackendClient initializes correctly"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        assert client.base_url == "https://api.example.com"
        assert client.api_key_id == "test-key"
        assert client.webhook_secret == "test-secret"
        assert client.timeout == 30
    
    def test_backend_client_base_url_strip(self):
        """Test that base_url trailing slash is stripped"""
        client = BackendClient(
            base_url="https://api.example.com/",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        assert client.base_url == "https://api.example.com"
    
    def test_create_hmac_signature(self):
        """Test HMAC signature generation"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        payload = {"user_id": 123, "action": "test"}
        timestamp = 1234567890
        
        signature = client._create_hmac_signature(payload, timestamp)
        
        # Signature should be a valid hex string
        assert isinstance(signature, str)
        assert len(signature) == 64  # SHA256 hex is 64 chars
    
    def test_get_user_metadata(self):
        """Test get_user_metadata method"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        # Mock the session.post method with proper response format
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'users': [
                {'userId': 'user1', 'firstName': 'John', 'lastName': 'Doe'}
            ]
        }
        mock_response.raise_for_status = Mock()
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.get_user_metadata(['user1'])
            
            assert result is not None
            assert 'user1' in result
            assert result['user1']['firstName'] == 'John'
    
    def test_create_hmac_signature_different_payloads(self):
        """Test that different payloads produce different signatures"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        payload1 = {"user_id": 123}
        payload2 = {"user_id": 456}
        timestamp = 1234567890
        
        sig1 = client._create_hmac_signature(payload1, timestamp)
        sig2 = client._create_hmac_signature(payload2, timestamp)
        
        assert sig1 != sig2
    
    def test_get_user_metadata_empty_list(self):
        """Test get_user_metadata with empty list"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        result = client.get_user_metadata([])
        assert result == {}
    
    def test_get_user_metadata_not_list(self):
        """Test get_user_metadata with non-list input"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        with pytest.raises(BackendIntegrationError, match="must be a list"):
            client.get_user_metadata("not-a-list")
    
    def test_get_user_metadata_too_many(self):
        """Test get_user_metadata with >100 users"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        user_ids = [f"user{i}" for i in range(101)]
        with pytest.raises(BackendIntegrationError, match="Too many"):
            client.get_user_metadata(user_ids)
    
    def test_get_user_metadata_invalid_format(self):
        """Test get_user_metadata with invalid response format"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'success': True, 'users': 'not-a-list'}
        mock_response.raise_for_status = Mock()
        
        with patch.object(client.session, 'post', return_value=mock_response):
            with pytest.raises(BackendIntegrationError, match="Invalid response format"):
                client.get_user_metadata(['user1'])
    
    def test_get_user_metadata_filters_none(self):
        """Test get_user_metadata filters out None values"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'users': [
                {'userId': 'user1', 'firstName': 'John', 'lastName': 'Doe'}
            ]
        }
        mock_response.raise_for_status = Mock()
        
        with patch.object(client.session, 'post', return_value=mock_response):
            # Should filter out None and empty string
            result = client.get_user_metadata([None, 'user1', '', '  '])
            
            assert 'user1' in result
            assert result['user1']['firstName'] == 'John'
    
    def test_make_request_error_handling(self):
        """Test _make_request error handling"""
        from enrich.backend_client import BackendIntegrationError
        
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        # Mock to raise an exception during post
        with patch('requests.Session.post') as mock_post:
            mock_post.side_effect = Exception("Network error")
            
            with pytest.raises(Exception):  # Any exception is fine
                client._make_request('/api/test', {'test': 'data'})
    
    def test_get_user_metadata_unexpected_error(self):
        """Test get_user_metadata with unexpected error"""
        from enrich.backend_client import BackendIntegrationError
        
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        with patch.object(client, '_make_request', side_effect=RuntimeError("Unexpected")):
            with pytest.raises(BackendIntegrationError, match="Unexpected error"):
                client.get_user_metadata(['user1'])
    
    def test_make_request_success_false(self):
        """Test _make_request when API returns success=false"""
        from enrich.backend_client import BackendIntegrationError
        
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'success': False, 'error': 'test error'}
        mock_response.raise_for_status = Mock()
        
        with patch.object(client.session, 'post', return_value=mock_response):
            with pytest.raises(BackendIntegrationError, match="success=false"):
                client._make_request('/api/test', {'test': 'data'})
    
    def test_make_request_non_200_status(self):
        """Test _make_request with non-200 status code"""
        from enrich.backend_client import BackendIntegrationError
        
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"
        mock_response.raise_for_status = Mock()
        
        with patch.object(client.session, 'post', return_value=mock_response):
            with pytest.raises(BackendIntegrationError, match="404"):
                client._make_request('/api/test', {'test': 'data'})
    
    def test_make_request_exception_with_response(self):
        """Test _make_request handles RequestException with response attribute"""
        from enrich.backend_client import BackendIntegrationError
        import requests
        
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        # Create a RequestException with response attribute
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        
        exception = requests.RequestException("Connection error")
        exception.response = mock_response
        
        with patch.object(client.session, 'post', side_effect=exception):
            with pytest.raises(BackendIntegrationError) as exc_info:
                client._make_request('/api/test', {'test': 'data'})
            
            # Error message should include response details
            assert "500" in str(exc_info.value) or "Request failed" in str(exc_info.value)
    
    def test_get_user_metadata_malformed_entries(self):
        """Test get_user_metadata skips malformed user entries"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'success': True,
            'users': [
                {'userId': 'user1', 'firstName': 'John', 'lastName': 'Doe'},
                'not-a-dict',  # Malformed entry
                {'firstName': 'Jane'},  # Missing userId
                {},  # Empty dict
                {'userId': 'user2', 'firstName': 'Jane', 'lastName': 'Smith'},
            ]
        }
        mock_response.raise_for_status = Mock()
        
        with patch.object(client.session, 'post', return_value=mock_response):
            result = client.get_user_metadata(['user1', 'user2'])
            
            # Should only have user1 and user2, malformed entries skipped
            assert len(result) == 2
            assert 'user1' in result
            assert 'user2' in result
    
    def test_get_user_metadata_with_all_none_values(self):
        """Test get_user_metadata with all None/empty values returns empty dict"""
        client = BackendClient(
            base_url="https://api.example.com",
            api_key_id="test-key",
            webhook_secret="test-secret"
        )
        
        # All None or empty - should return empty dict without making request
        result = client.get_user_metadata([None, '', '  ', None])
        assert result == {}


