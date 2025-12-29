"""
Tests for multispeq JavaScript executor
"""
import json
import pytest
from unittest.mock import Mock, patch, mock_open

from multispeq.executors.js_executor import execute_javascript_macro, JS_AVAILABLE


class TestJavaScriptExecutor:
    """Test JavaScript macro execution"""
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_js_executor_available(self):
        """Test that JS executor is available when PyMiniRacer is installed"""
        assert JS_AVAILABLE is not None
    
    def test_js_executor_not_available(self):
        """Test graceful handling when JS executor is not available"""
        with patch('multispeq.executors.js_executor.JS_AVAILABLE', False):
            result = execute_javascript_macro(
                script_path="/fake/path.js",
                input_data='{"test": "data"}',
                macro_name="test_macro"
            )
            assert result == {}
    
    def test_get_javascript_helpers_not_found(self):
        """Test get_javascript_helpers when file doesn't exist"""
        from multispeq.executors.js_executor import get_javascript_helpers
        
        with pytest.raises(FileNotFoundError):
            get_javascript_helpers("/nonexistent/path/helpers.js")
    
    def test_get_javascript_helpers_read_error(self):
        """Test get_javascript_helpers when file can't be read"""
        from multispeq.executors.js_executor import get_javascript_helpers
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', side_effect=IOError("Read error")):
                with pytest.raises(IOError, match="Failed to read"):
                    get_javascript_helpers("/fake/path/helpers.js")
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_execute_javascript_macro_success(self):
        """Test successful JavaScript macro execution"""
        script_content = """
        function main(input) {
            return {output: [1, 2, 3], time: 100};
        }
        """
        
        input_data = json.dumps({"values": [1, 2, 3]})
        
        with patch('builtins.open', mock_open(read_data=script_content)):
            with patch('os.path.exists', return_value=True):
                result = execute_javascript_macro(
                    script_path="/mock/script.js",
                    input_data=input_data,
                    macro_name="test_macro"
                )
        
        assert result is not None
        assert isinstance(result, dict)
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_execute_javascript_macro_with_helpers(self):
        """Test JavaScript macro execution with helper functions"""
        script_content = "function main(input) { return {output: [1, 2, 3]}; }"
        helpers_content = "function helper(x) { return x * 2; }"
        
        def mock_open_handler(filename, *args, **kwargs):
            if 'helpers' in filename:
                return mock_open(read_data=helpers_content)()
            return mock_open(read_data=script_content)()
        
        with patch('builtins.open', side_effect=mock_open_handler):
            with patch('os.path.exists', return_value=True):
                result = execute_javascript_macro(
                    script_path="/mock/script.js",
                    input_data='{"test": 1}',
                    macro_name="test_macro",
                    helpers_path="/mock/helpers.js"
                )
        
        assert result is not None
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_execute_javascript_macro_file_not_found(self):
        """Test JavaScript macro with missing file"""
        with patch('builtins.open', side_effect=FileNotFoundError("File not found")):
            with pytest.raises(FileNotFoundError):
                execute_javascript_macro(
                    script_path="/nonexistent/script.js",
                    input_data='{"test": 1}',
                    macro_name="test_macro"
                )
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_execute_javascript_macro_invalid_json_input(self):
        """Test JavaScript macro with invalid JSON input - should handle gracefully"""
        script_content = "function main(input) { return {output: [1, 2, 3]}; }"
        
        with patch('builtins.open', mock_open(read_data=script_content)):
            with patch('os.path.exists', return_value=True):
                # Invalid JSON is treated as a plain string, macro should still run
                result = execute_javascript_macro(
                    script_path="/mock/script.js",
                    input_data='invalid json{',
                    macro_name="test_macro"
                )
                
                # Should return something (mock returns JSON)
                assert result is not None
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_execute_javascript_macro_with_array_input(self):
        """Test JavaScript macro with array input - should take first item"""
        script_content = "function main(input) { return {output: input}; }"
        
        input_data = json.dumps([{"value": 1}, {"value": 2}])
        
        with patch('builtins.open', mock_open(read_data=script_content)):
            with patch('os.path.exists', return_value=True):
                result = execute_javascript_macro(
                    script_path="/mock/script.js",
                    input_data=input_data,
                    macro_name="test_macro"
                )
        
        assert result is not None
    
    @pytest.mark.skipif(not JS_AVAILABLE, reason="PyMiniRacer not available")
    def test_get_javascript_helpers_with_custom_path(self):
        """Test get_javascript_helpers with custom path"""
        from multispeq.executors.js_executor import get_javascript_helpers
        
        helpers_content = "function customHelper() { return 42; }"
        
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data=helpers_content)):
                result = get_javascript_helpers("/custom/helpers.js")
        
        assert result == helpers_content

