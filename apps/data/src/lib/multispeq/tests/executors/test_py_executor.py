"""
Tests for multispeq Python executor
"""
import pytest
from unittest.mock import Mock, patch, mock_open, MagicMock
import json

from multispeq.executors.py_executor import execute_python_macro, get_python_helpers


class TestPythonExecutor:
    """Test Python macro execution"""
    
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='return {"result": 42}')
    def test_execute_python_macro_basic(self, mock_file, mock_exists):
        """Test basic Python macro execution"""
        mock_exists.return_value = True
        
        result = execute_python_macro(
            script_path="/fake/macro.py",
            input_data='{"sample": "test"}'
        )
        
        assert isinstance(result, dict)
        assert result.get("result") == 42

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='return {"data": input_data}')
    def test_execute_python_macro_json_array_input(self, mock_file, mock_exists):
        """Test Python macro with JSON array input (takes first item)"""
        mock_exists.return_value = True
        
        result = execute_python_macro(
            script_path="/fake/macro.py",
            input_data='[{"value": 123}, {"value": 456}]'
        )
        
        assert isinstance(result, dict)
        assert result.get("data") == {"value": 123}  # Should take first item

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='return {"raw": input_data}')
    def test_execute_python_macro_invalid_json(self, mock_file, mock_exists):
        """Test Python macro with invalid JSON input (falls back to string)"""
        mock_exists.return_value = True
        
        result = execute_python_macro(
            script_path="/fake/macro.py",
            input_data='not valid json'
        )
        
        assert isinstance(result, dict)
        assert result.get("raw") == "not valid json"

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='return {"hasNumpy": np is not None}')
    def test_execute_python_macro_with_numpy(self, mock_file, mock_exists):
        """Test Python macro execution with NumPy available"""
        mock_exists.return_value = True
        
        result = execute_python_macro(
            script_path="/fake/macro.py",
            input_data='{}'
        )
        
        assert isinstance(result, dict)
        # NumPy should be available in this environment
        assert result.get("hasNumpy") == True

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='return {"mathAvailable": math is not None}')
    def test_execute_python_macro_with_modules(self, mock_file, mock_exists):
        """Test Python macro execution with safe modules available"""
        mock_exists.return_value = True
        
        result = execute_python_macro(
            script_path="/fake/macro.py",
            input_data='{}'
        )
        
        assert isinstance(result, dict)
        assert result.get("mathAvailable") == True

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='return input_data.get("protocol", {})')
    def test_execute_python_macro_protocol_data(self, mock_file, mock_exists):
        """Test Python macro with protocol data access"""
        mock_exists.return_value = True
        
        result = execute_python_macro(
            script_path="/fake/macro.py",
            input_data='{"protocol": {"steps": [1, 2, 3]}, "data": [10, 20]}'
        )
        
        assert isinstance(result, dict)
        assert "steps" in result

    def test_execute_python_macro_with_error(self):
        """Test Python executor with code that raises an error"""
        # Test error handling by having code that doesn't return anything
        with patch('os.path.exists', return_value=True):
            with patch('builtins.open', mock_open(read_data='pass  # No return statement')):
                result = execute_python_macro(
                    script_path="/fake/macro.py",
                    input_data='{}'
                )
                
                # Should return empty dict when no return statement
                assert isinstance(result, dict)
    
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='raise ValueError("Test error")')
    def test_execute_python_macro_execution_error(self, mock_file, mock_exists):
        """Test Python macro execution with script error"""
        mock_exists.return_value = True
        
        with pytest.raises(Exception):
            execute_python_macro(
                script_path="/fake/macro.py",
                input_data='{}'
            )

    @patch('os.path.exists')
    @patch('builtins.open')
    def test_execute_python_macro_file_read_error(self, mock_file, mock_exists):
        """Test Python macro execution with file read error"""
        mock_exists.return_value = True
        mock_file.side_effect = IOError("Cannot read file")
        
        with pytest.raises(Exception):
            execute_python_macro(
                script_path="/fake/macro.py",
                input_data='{}'
            )


class TestPythonHelpers:
    """Test Python helper loading"""

    @patch('os.path.exists')
    def test_get_python_helpers_file_not_found(self, mock_exists):
        """Test helper loading when file doesn't exist"""
        mock_exists.return_value = False
        
        helpers = get_python_helpers("/fake/path/helpers.py")
        
        assert helpers == {}

    @patch('os.path.exists')
    @patch('importlib.util.spec_from_file_location')
    def test_get_python_helpers_import_error(self, mock_spec_from, mock_exists):
        """Test helper loading with import error"""
        mock_exists.return_value = True
        mock_spec_from.side_effect = ImportError("Cannot import")
        
        helpers = get_python_helpers("/fake/path/helpers.py")
        
        assert helpers == {}

    @patch('os.path.exists')
    @patch('importlib.util.spec_from_file_location')
    @patch('importlib.util.module_from_spec')
    def test_get_python_helpers_success(self, mock_module_from, mock_spec_from, mock_exists):
        """Test successful helper loading"""
        mock_exists.return_value = True
        
        # Mock the module and spec
        mock_spec = MagicMock()
        mock_module = MagicMock()
        
        # Add some callable and non-callable attributes
        def helper_func():
            return "helper"
        
        mock_module.helper_func = helper_func
        mock_module.some_var = 123
        mock_module._private_func = lambda: "private"
        
        mock_spec_from.return_value = mock_spec
        mock_module_from.return_value = mock_module
        
        # Mock dir() to return our attributes
        with patch('builtins.dir', return_value=['helper_func', 'some_var', '_private_func']):
            helpers = get_python_helpers("/fake/path/helpers.py")
        
        # Should only include public callables
        assert 'helper_func' in helpers
        assert 'some_var' not in helpers
        assert '_private_func' not in helpers
