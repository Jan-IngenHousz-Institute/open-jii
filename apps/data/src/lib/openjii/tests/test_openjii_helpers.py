"""
Tests for openjii helpers module
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd


class TestReadTable:
    """Test read_table function"""
    
    def test_read_table_basic(self):
        """Test basic table reading with mocked Spark"""
        from openjii.helpers import read_table
        
        # The spark fixture returns our MockSparkSession which is already in sys.modules
        # So read_table will use it automatically when it calls SparkSession.builder.getOrCreate()
        with patch('openjii.helpers.CATALOG_NAME', 'test_catalog'):
            result = read_table('test_table', 'test_schema')
            
            assert result is not None
            assert isinstance(result, pd.DataFrame)
    
    def test_read_table_with_limit(self):
        """Test table reading with limit"""
        from openjii.helpers import read_table
        
        with patch('openjii.helpers.CATALOG_NAME', 'catalog'):
            result = read_table('my_table', 'my_schema', limit=100)
            
            assert result is not None
            assert isinstance(result, pd.DataFrame)


class TestConfig:
    """Test configuration loading"""
    
    def test_catalog_name_exists(self):
        """Test that CATALOG_NAME is defined"""
        from openjii._config import CATALOG_NAME
        
        assert CATALOG_NAME is not None
        assert isinstance(CATALOG_NAME, str)
    
    def test_get_catalog_name(self):
        """Test get_catalog_name function"""
        from openjii.helpers import get_catalog_name
        
        result = get_catalog_name()
        
        assert result is not None
        assert isinstance(result, str)
    
    def test_explode_set_data(self):
        """Test explode_set_data function"""
        from openjii.helpers import explode_set_data
        
        # Verify function exists and is callable
        assert callable(explode_set_data)
    
    def test_explode_set_data_with_sample_data(self):
        """Test explode_set_data with sample nested data"""
        from openjii.helpers import explode_set_data
        
        # Create sample dataframe with nested set column
        sample_data = pd.DataFrame({
            'id': [1, 2],
            'name': ['test1', 'test2'],
            'set': [
                [{'temp': 20, 'humidity': 50}, {'temp': 21, 'humidity': 51}],
                [{'temp': 22, 'humidity': 52}]
            ]
        })
        
        result = explode_set_data(sample_data)
        
        # Should have exploded rows (1 row with 2 items + 1 row with 1 item = 3 total)
        assert len(result) == 3
        # Should have temp and humidity columns
        assert 'temp' in result.columns
        assert 'humidity' in result.columns
        # Original columns should be preserved
        assert 'id' in result.columns
        assert 'name' in result.columns
    
    def test_explode_set_data_empty_arrays(self):
        """Test explode_set_data with empty arrays"""
        from openjii.helpers import explode_set_data
        
        sample_data = pd.DataFrame({
            'id': [1],
            'set': [[]]  # Empty array
        })
        
        result = explode_set_data(sample_data)
        
        # Should handle empty arrays gracefully
        assert isinstance(result, pd.DataFrame)
