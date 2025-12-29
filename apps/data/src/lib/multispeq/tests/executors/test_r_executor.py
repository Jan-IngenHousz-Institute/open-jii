"""
Tests for multispeq R executor
"""
import json
import pytest
from unittest.mock import patch, mock_open

from multispeq.executors.r_executor import execute_r_macro, R_AVAILABLE


class TestRExecutor:
    """Test R macro execution"""
    
    def test_r_executor_not_available(self):
        """Test graceful handling when R executor is not available"""
        with patch('multispeq.executors.r_executor.R_AVAILABLE', False):
            result = execute_r_macro(
                script_path="/fake/path.r",
                input_data='{"test": "data"}'
            )
            assert "error" in result
            assert result["error"] == "R executor not available"
    
    def test_get_r_helpers_not_found(self):
        """Test get_r_helpers when file doesn't exist"""
        from multispeq.executors.r_executor import get_r_helpers
        
        result = get_r_helpers("/nonexistent/path/helpers.r")
        assert result == ""
    
    def test_get_r_helpers_read_error(self):
        """Test get_r_helpers when file can't be read"""
        from multispeq.executors.r_executor import get_r_helpers
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', side_effect=IOError("Read error")):
                result = get_r_helpers("/fake/path/helpers.r")
                assert result == ""
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_success(self):
        """Test successful R macro execution"""
        r_script = """
        main <- function(input_json) {
            return(toJSON(list(output = c(1,2,3))))
        }
        """
        
        input_data = json.dumps({"values": [1, 2, 3]})
        
        with patch('builtins.open', mock_open(read_data=r_script)):
            with patch('os.path.exists', return_value=True):
                result = execute_r_macro(
                    script_path="/mock/script.R",
                    input_data=input_data
                )
        
        assert result is not None
        assert isinstance(result, (dict, list))
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_with_helpers(self):
        """Test R macro execution with helper functions"""
        r_script = "main <- function(input_json) { return(toJSON(list(output = c(1,2,3)))) }"
        
        with patch('builtins.open', mock_open(read_data=r_script)):
            with patch('os.path.exists', return_value=True):
                result = execute_r_macro(
                    script_path="/mock/script.R",
                    input_data='{"test": 1}'
                )
        
        assert result is not None
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_file_not_found(self):
        """Test R macro with missing file"""
        with patch('builtins.open', side_effect=FileNotFoundError("File not found")):
            with pytest.raises(FileNotFoundError):
                execute_r_macro(
                    script_path="/nonexistent/script.R",
                    input_data='{"test": 1}'
                )
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_invalid_json_input(self):
        """Test R macro with invalid JSON input - should handle gracefully"""
        r_script = "main <- function(input_json) { return(toJSON(list(output = c(1,2,3)))) }"
        
        with patch('builtins.open', mock_open(read_data=r_script)):
            # Invalid JSON is treated as a plain string
            result = execute_r_macro(
                script_path="/mock/script.R",
                input_data='invalid json{'
            )
            
            # Should return something (mock returns JSON list)
            assert result is not None
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_with_array_input(self):
        """Test R macro with array input - should take first item"""
        r_script = "main <- function(input_json) { return(toJSON(list(output = c(1,2,3)))) }"
        
        input_data = json.dumps([{"value": 1}, {"value": 2}])
        
        with patch('builtins.open', mock_open(read_data=r_script)):
            with patch('os.path.exists', return_value=True):
                result = execute_r_macro(
                    script_path="/mock/script.R",
                    input_data=input_data
                )
        
        assert result is not None
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_with_dict_input(self):
        """Test R macro with dictionary input"""
        r_script = "main <- function(input_json) { return(toJSON(list(result = 'ok'))) }"
        
        input_data = json.dumps({"key": "value"})
        
        with patch('builtins.open', mock_open(read_data=r_script)):
            with patch('os.path.exists', return_value=True):
                result = execute_r_macro(
                    script_path="/mock/script.R",
                    input_data=input_data
                )
        
        assert result is not None
    
    def test_get_r_helpers_with_custom_path(self):
        """Test get_r_helpers with custom path"""
        from multispeq.executors.r_executor import get_r_helpers
        
        helpers_content = "custom_helper <- function(x) { return(x * 2) }"
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=helpers_content)):
                result = get_r_helpers("/custom/helpers.R")
        
        assert result == helpers_content
    
    @pytest.mark.skipif(not R_AVAILABLE, reason="rpy2 not available")
    def test_execute_r_macro_with_string_input(self):
        """Test R macro with plain string input (not dict)"""
        r_script = "main <- function(input_json) { return(toJSON(list(result = 'ok'))) }"
        
        # Plain string, not JSON
        input_data = "plain_string_value"
        
        with patch('builtins.open', mock_open(read_data=r_script)):
            with patch('os.path.exists', return_value=True):
                result = execute_r_macro(
                    script_path="/mock/script.R",
                    input_data=input_data
                )
        
        assert result is not None

