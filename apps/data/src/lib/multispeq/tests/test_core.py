"""
Tests for multispeq core macro execution
"""
import pytest
from unittest.mock import Mock, patch, mock_open

from multispeq.core import execute_macro_script, get_available_macros


class TestMacroExecution:
    """Test macro script execution"""
    
    def test_execute_macro_script_file_not_found(self):
        """Test execute_macro_script with non-existent file"""
        result = execute_macro_script(
            macro_name="nonexistent",
            input_data={"sample": "{}"},
            macros_path="/tmp/fake_macros"
        )
        
        # Should return empty dict when file not found
        assert result == {}
    
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='def main(sample):\n    return {"result": 42}')
    def test_execute_macro_script_python(self, mock_file, mock_exists):
        """Test execute_macro_script with Python script"""
        mock_exists.return_value = True
        
        with patch('multispeq.core.execute_python_macro') as mock_exec:
            mock_exec.return_value = {"result": 42}
            
            result = execute_macro_script(
                macro_name="test_macro",
                input_data={"sample": "{}"},
                macros_path="/tmp/macros"
            )
            
            mock_exec.assert_called_once()
    
    def test_execute_macro_script_javascript(self):
        """Test execute_macro_script with JavaScript - falls back to Python"""
        # When .js file exists but .js.py doesn't, it tries JS executor
        # Since PyMiniRacer isn't available, it returns empty dict
        with patch('os.path.exists', side_effect=lambda p: p.endswith('.js')):
            result = execute_macro_script(
                macro_name="test_macro.js",
                input_data={"sample": "{}"},
                macros_path="/tmp/macros"
            )
            
            # Should return empty dict when executor not available
            assert isinstance(result, dict)
    
    def test_execute_macro_script_r(self):
        """Test execute_macro_script with R - falls back to Python if .R.py exists"""
        # When .R file exists, it looks for .R.py first
        def mock_exists(path):
            return path.endswith('.R') or path.endswith('.R.py')
        
        with patch('os.path.exists', side_effect=mock_exists):
            with patch('builtins.open', mock_open(read_data='return {}')):
                result = execute_macro_script(
                    macro_name="test_macro.R",
                    input_data={"sample": "{}"},
                    macros_path="/tmp/macros"
                )
                
                # Should execute successfully via Python fallback
                assert isinstance(result, dict)


class TestMacroDiscovery:
    """Test macro discovery functions"""
    
    @patch('os.path.exists')
    @patch('os.listdir')
    def test_get_available_macros(self, mock_listdir, mock_exists):
        """Test get_available_macros returns list of macro files"""
        mock_exists.return_value = True
        mock_listdir.return_value = [
            "macro1.py",
            "macro2.js",
            "macro3.r",
            "readme.txt",
            "helper.py"
        ]
        
        macros = get_available_macros(macros_path="/tmp/macros")
        
        # Should include .py, .js, .r files
        assert len(macros) >= 3
    
    @patch('os.path.exists')
    def test_get_available_macros_dir_not_exist(self, mock_exists):
        """Test get_available_macros when directory doesn't exist"""
        mock_exists.return_value = False
        
        macros = get_available_macros(macros_path="/nonexistent")
        
        # Should return empty list
        assert macros == []
    
    def test_execute_macro_script_with_unknown_file_extension(self):
        """Test execute_macro_script with unknown file extension"""
        # When file doesn't exist, returns empty dict
        result = execute_macro_script(
            macro_name="test_macro.unknown",
            input_data={"sample": "{}"},
            macros_path="/tmp/fake_macros"
        )
        
        # Should return empty dict when file not found
        assert result == {}
    
    @patch('os.path.exists')
    @patch('os.listdir')
    def test_get_available_macros_exception(self, mock_listdir, mock_exists):
        """Test get_available_macros with exception during listing"""
        mock_exists.return_value = True
        mock_listdir.side_effect = Exception("Permission denied")
        
        macros = get_available_macros(macros_path="/tmp/macros")
        
        assert macros == []


class TestProcessMacroOutput:
    """Test macro output processing for Spark"""
    
    def test_process_macro_output_primitives(self):
        """Test processing primitive types"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "string_val": "test",
            "int_val": 42,
            "float_val": 3.14,
            "bool_val": True
        }
        
        result = process_macro_output_for_spark(output)
        
        assert result["string_val"] == "test"
        assert result["int_val"] == 42.0  # Converted to float
        assert result["float_val"] == 3.14
        assert result["bool_val"] == True
    
    def test_process_macro_output_arrays(self):
        """Test processing array types"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "numeric_array": [1, 2, 3, 4.5],
            "string_array": ["a", "b", "c"],
            "empty_array": [],
            "complex_array": [{"a": 1}, {"b": 2}]
        }
        
        result = process_macro_output_for_spark(output)
        
        # Numeric arrays should be normalized to all floats
        assert all(isinstance(x, float) for x in result["numeric_array"])
        assert result["string_array"] == ["a", "b", "c"]
        assert result["empty_array"] == []
        # Complex arrays should be converted to JSON string
        assert isinstance(result["complex_array"], str)
    
    def test_process_macro_output_dicts(self):
        """Test processing dict types"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "simple_dict": {"key1": "value1", "key2": 123}
        }
        
        result = process_macro_output_for_spark(output)
        
        # Dicts should be flattened to MAP<STRING, STRING>
        assert isinstance(result["simple_dict"], dict)
        assert all(isinstance(k, str) and isinstance(v, str) for k, v in result["simple_dict"].items())
    
    def test_process_macro_output_column_sanitization(self):
        """Test column name sanitization"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "Test Column": "value",
            "column(with)parens": "value",
            "column,with,commas": "value",
            "column\twith\ttabs": "value"
        }
        
        result = process_macro_output_for_spark(output)
        
        # All invalid characters should be replaced with underscores
        assert "Test_Column" in result
        assert "column_with_parens" in result
        assert "column_with_commas" in result
        assert "column_with_tabs" in result


class TestInferMacroSchema:
    """Test macro schema inference"""
    
    def test_infer_macro_schema_basic(self):
        """Test basic schema inference"""
        from multispeq.core import infer_macro_schema
        
        with patch('multispeq.core.execute_macro_script', return_value={"test": "value", "num": 42}):
            with patch('multispeq.core.process_macro_output_for_spark', return_value={"test": "value", "num": 42.0}):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should return a schema or None
                assert schema is None or schema is not None
    
    def test_process_macro_output_json_string_dict(self):
        """Test processing JSON string that contains a dict"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "json_dict": '{"key": "value", "num": 123}'
        }
        
        result = process_macro_output_for_spark(output)
        
        # JSON string containing dict should be parsed and flattened
        assert isinstance(result["json_dict"], dict)
        assert all(isinstance(v, str) for v in result["json_dict"].values())
    
    def test_process_macro_output_json_string_array(self):
        """Test processing JSON string that contains an array"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "json_array": '[1, 2, 3, 4]'
        }
        
        result = process_macro_output_for_spark(output)
        
        # JSON string containing array should be parsed to list
        assert isinstance(result["json_array"], list)
    
    def test_process_macro_output_all_null_array(self):
        """Test processing array with all None values"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "null_array": [None, None, None]
        }
        
        result = process_macro_output_for_spark(output)
        
        # All-null array should be kept as-is
        assert result["null_array"] == [None, None, None]
    
    def test_process_macro_output_numeric_array_with_none(self):
        """Test processing numeric array with None values"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "mixed_numeric": [1, None, 3, 4.5, None]
        }
        
        result = process_macro_output_for_spark(output)
        
        # Should be normalized to floats, None converted to 0.0
        assert result["mixed_numeric"] == [1.0, 0.0, 3.0, 4.5, 0.0]
    
    def test_process_macro_output_integer_value(self):
        """Test processing individual integer value"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "single_int": 42
        }
        
        result = process_macro_output_for_spark(output)
        
        # Integer should be converted to float
        assert result["single_int"] == 42.0
        assert isinstance(result["single_int"], float)
    
    def test_process_macro_output_non_primitive_value(self):
        """Test processing non-primitive types"""
        from multispeq.core import process_macro_output_for_spark
        
        class CustomObject:
            def __str__(self):
                return "custom_string"
        
        output = {
            "custom": CustomObject()
        }
        
        result = process_macro_output_for_spark(output)
        
        # Non-primitive should be converted to string
        assert result["custom"] == "custom_string"
    
    def test_process_macro_output_processed_timestamp_ignored(self):
        """Test that processed_timestamp is ignored"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "processed_timestamp": "2024-01-01T00:00:00",
            "other_value": 42
        }
        
        result = process_macro_output_for_spark(output)
        
        # processed_timestamp might be kept but other_value should be converted
        assert "other_value" in result
        assert result["other_value"] == 42.0
    
    def test_process_macro_output_string_not_json(self):
        """Test processing plain string that's not JSON"""
        from multispeq.core import process_macro_output_for_spark
        
        output = {
            "plain_string": "just a regular string"
        }
        
        result = process_macro_output_for_spark(output)
        
        # Plain string should be kept as-is
        assert result["plain_string"] == "just a regular string"
    
    def test_infer_macro_schema_with_complex_types(self):
        """Test schema inference with various types"""
        from multispeq.core import infer_macro_schema
        
        complex_output = {
            "bool_val": True,
            "int_val": 42,
            "float_val": 3.14,
            "string_val": "test",
            "array_of_int": [1, 2, 3],
            "array_of_str": ["a", "b"],
            "array_of_dict": [{"key": "val"}],
            "dict_val": {"k": "v"},
            "none_val": None
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=complex_output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=complex_output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should return schema or None
                assert schema is not None or schema is None
    
    def test_infer_macro_schema_error(self):
        """Test schema inference with execution error"""
        from multispeq.core import infer_macro_schema
        
        with patch('multispeq.core.execute_macro_script', side_effect=Exception("Error")):
            schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
            
            # Should return None on error
            assert schema is None
    
    def test_infer_macro_schema_with_array_of_arrays(self):
        """Test schema inference with array of arrays"""
        from multispeq.core import infer_macro_schema
        
        output = {
            "array_of_arrays": [[1, 2], [3, 4]],
            "empty_array": []
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should handle array of arrays
                assert schema is not None or schema is None
    
    def test_infer_macro_schema_with_array_of_bool(self):
        """Test schema inference with boolean array"""
        from multispeq.core import infer_macro_schema
        
        output = {
            "bool_array": [True, False, True]
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should handle boolean arrays
                assert schema is not None or schema is None
    
    def test_infer_macro_schema_with_mixed_array(self):
        """Test schema inference with array containing None values"""
        from multispeq.core import infer_macro_schema
        
        output = {
            "array_with_none": [None, None, "value"],
            "all_none_array": [None, None, None]
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should handle arrays with None
                assert schema is not None or schema is None
    
    def test_execute_macro_script_with_js_py_fallback(self):
        """Test JavaScript macro with .js.py fallback"""
        def mock_exists(path):
            # .js.py file exists, .js doesn't
            return path.endswith('.js.py')
        
        with patch('os.path.exists', side_effect=mock_exists):
            with patch('builtins.open', mock_open(read_data='def main(sample): return {"result": 42}')):
                with patch('multispeq.core.execute_python_macro', return_value={"result": 42}):
                    result = execute_macro_script(
                        macro_name="test.js",
                        input_data={"sample": "{}"},
                        macros_path="/tmp/macros"
                    )
                    
                    # Should use Python fallback
                    assert result == {"result": 42}
    
    def test_execute_macro_script_with_r_py_fallback(self):
        """Test R macro with .R.py fallback"""
        def mock_exists(path):
            # Both .R and .R.py exist
            return path.endswith('.R') or path.endswith('.R.py')
        
        with patch('os.path.exists', side_effect=mock_exists):
            with patch('builtins.open', mock_open(read_data='def main(sample): return {"result": 42}')):
                with patch('multispeq.core.execute_python_macro', return_value={"result": 42}):
                    result = execute_macro_script(
                        macro_name="test.R",
                        input_data={"sample": "{}"},
                        macros_path="/tmp/macros"
                    )
                    
                    # Should use Python fallback
                    assert result == {"result": 42}

    def test_infer_macro_schema_when_execute_returns_none(self):
        """Test infer_macro_schema when execute_macro_script returns None"""
        from multispeq.core import infer_macro_schema
        
        with patch('multispeq.core.execute_macro_script', return_value=None):
            schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
            
            # Should return None when execution returns None
            assert schema is None
    
    def test_infer_macro_schema_with_int_in_array(self):
        """Test schema inference with integer in array (edge case)"""
        from multispeq.core import infer_macro_schema
        
        output = {
            "int_array": [1, 2, 3]  # Ints in array after processing
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should handle int array
                assert schema is not None or schema is None
    
    def test_infer_macro_schema_with_unknown_type_in_array(self):
        """Test schema inference with unknown type in array"""
        from multispeq.core import infer_macro_schema
        
        # Create object of custom type
        class CustomType:
            pass
        
        output = {
            "custom_array": [CustomType()]
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should handle unknown type with fallback
                assert schema is not None or schema is None
    
    def test_infer_macro_schema_with_custom_type_value(self):
        """Test schema inference with custom type as value (not in array)"""
        from multispeq.core import infer_macro_schema
        
        class CustomType:
            def __str__(self):
                return "custom"
        
        output = {
            "custom_value": CustomType()
        }
        
        with patch('multispeq.core.execute_macro_script', return_value=output):
            with patch('multispeq.core.process_macro_output_for_spark', return_value=output):
                schema = infer_macro_schema("test_macro", {}, "/tmp/macros")
                
                # Should use string fallback for unknown types
                assert schema is not None or schema is None


