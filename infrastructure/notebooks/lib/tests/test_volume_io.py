"""
Unit tests for volume_io.py module.
"""

import os
import sys
import unittest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

# Add the parent directory to Python path so we can import volume_io
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock PySpark and dbutils before importing volume_io
spark_session_mock = MagicMock()
dbutils_mock = MagicMock()
sys.modules['pyspark'] = MagicMock()
sys.modules['pyspark.sql'] = MagicMock()
sys.modules['pyspark.sql.SparkSession'] = MagicMock()
sys.modules['pyspark.dbutils'] = MagicMock()
sys.modules['pyspark.dbutils.DBUtils'] = MagicMock()

# Mock the spark and dbutils globals
import volume_io
volume_io.spark = spark_session_mock
volume_io.dbutils = dbutils_mock

from volume_io import parse_upload_time, prepare_ambyte_files


class TestParseUploadTime(unittest.TestCase):
    """Test parse_upload_time function."""
    
    def test_parse_upload_time_valid_format(self):
        """Test parsing valid upload directory name."""
        result = parse_upload_time('upload_20250901_01')
        
        expected = datetime(2025, 9, 1)
        self.assertEqual(result, expected)
    
    def test_parse_upload_time_different_valid_dates(self):
        """Test parsing various valid dates."""
        test_cases = [
            ('upload_20241231_99', datetime(2024, 12, 31)),
            ('upload_20250101_01', datetime(2025, 1, 1)),
            ('upload_20250630_15', datetime(2025, 6, 30)),
            ('upload_20231201_05', datetime(2023, 12, 1))
        ]
        
        for dir_name, expected_date in test_cases:
            with self.subTest(dir_name=dir_name):
                result = parse_upload_time(dir_name)
                self.assertEqual(result, expected_date)
    
    def test_parse_upload_time_invalid_format(self):
        """Test parsing invalid directory name formats."""
        invalid_names = [
            'upload_invalid_format',
            'upload_2025901_01',     # missing zero
            'upload_20250901',       # missing sequence number
            'upload_202509011_01',   # too many digits
            'not_upload_20250901_01',
            'upload_20250901_',      # missing sequence number
            'upload__01',            # missing date
            'upload_abc_01',         # non-numeric date
            ''                       # empty string
        ]
        
        for invalid_name in invalid_names:
            with self.subTest(invalid_name=invalid_name):
                with patch('builtins.print') as mock_print:
                    result = parse_upload_time(invalid_name)
                
                self.assertIsNone(result)
                if invalid_name:  # Don't check print for empty string
                    mock_print.assert_called_once()
                    self.assertIn("Could not parse upload time", mock_print.call_args[0][0])
    
    def test_parse_upload_time_invalid_date(self):
        """Test parsing with invalid date values."""
        invalid_dates = [
            'upload_20250230_01',  # February 30th doesn't exist
            'upload_20250431_01',  # April 31st doesn't exist
            'upload_20251301_01',  # Month 13 doesn't exist
            'upload_20250001_01',  # Day 0 doesn't exist
        ]
        
        for invalid_date in invalid_dates:
            with self.subTest(invalid_date=invalid_date):
                with patch('builtins.print') as mock_print:
                    result = parse_upload_time(invalid_date)
                
                self.assertIsNone(result)
                mock_print.assert_called_once()
                self.assertIn("Error parsing upload time", mock_print.call_args[0][0])
    
    def test_parse_upload_time_edge_cases(self):
        """Test edge cases for date parsing."""
        # Leap year
        result = parse_upload_time('upload_20240229_01')
        expected = datetime(2024, 2, 29)
        self.assertEqual(result, expected)
        
        # Non-leap year February
        result = parse_upload_time('upload_20230228_01')
        expected = datetime(2023, 2, 28)
        self.assertEqual(result, expected)


class TestPrepareAmbyteFiles(unittest.TestCase):
    """Test prepare_ambyte_files function."""
    
    def test_prepare_ambyte_files_basic_structure(self):
        """Test basic file organization functionality."""
        # Mock file data structure as it would come from Auto Loader
        files_data = [
            {
                'content': 'I1\t4039\t1748882921\nA\t27306\t44136\nT0\t26870\nT1\t192,208\nT2\t6580,7369\nmore\nlines\nhere\nEOF',
                'file_path': '/path/upload_20250901_01/Ambyte_1/1/file1.txt',
                'ambit_index': '1'
            },
            {
                'content': 'I1\t4039\t1748882921\nA\t27306\t44136\nT0\t26870\nT1\t192,208\nT2\t6580,7369\nmore\nlines\nhere\nEOF',
                'file_path': '/path/upload_20250901_01/Ambyte_1/2/file2.txt',
                'ambit_index': '2'
            }
        ]
        
        result = prepare_ambyte_files(files_data, 'upload_20250901_01', 'Ambyte_1')
        
        self.assertIsNotNone(result)
        files_per_byte, upload_time, folder_name = result
        
        # Should organize files into non-empty slots (filters out empty ones)
        self.assertEqual(len(files_per_byte), 2)  # Only 2 non-empty slots
        self.assertGreater(len(files_per_byte[0]), 0)  # First ambit slot should have data
        self.assertGreater(len(files_per_byte[1]), 0)  # Second ambit slot should have data
        
        # Should parse upload time
        self.assertIsInstance(upload_time, datetime)
        self.assertEqual(upload_time, datetime(2025, 9, 1))
        
        # Should return folder name
        self.assertEqual(folder_name, 'Ambyte_1')
    
    def test_prepare_ambyte_files_unknown_ambit(self):
        """Test handling of unknown ambit files."""
        files_data = [
            {
                'content': 'I1\t4039\t1748882921\nA\t27306\t44136\nT0\t26870\nT1\t192,208\nT2\t6580,7369\nmore\nlines\nhere\nEOF',
                'file_path': '/path/upload_20250901_01/Ambyte_1/unknown_ambit/file.txt',
                'ambit_index': ''
            }
        ]
        
        result = prepare_ambyte_files(files_data, 'upload_20250901_01', 'Ambyte_1')
        
        self.assertIsNotNone(result)
        files_per_byte, upload_time, folder_name = result
        
        # Unknown ambit files should go to first slot, and only have 1 non-empty slot
        self.assertEqual(len(files_per_byte), 1)  # Only 1 non-empty slot
        self.assertGreater(len(files_per_byte[0]), 0)  # First slot should have data
    
    def test_prepare_ambyte_files_insufficient_content(self):
        """Test handling of files with insufficient content."""
        files_data = [
            {
                'content': 'short\ncontent\nEOF',  # Only 3 lines, should be filtered out
                'file_path': '/path/upload_20250901_01/Ambyte_1/1/file.txt',
                'ambit_index': '1'
            }
        ]
        
        result = prepare_ambyte_files(files_data, 'upload_20250901_01', 'Ambyte_1')
        
        # Should return None because no valid files
        self.assertIsNone(result)
    
    def test_prepare_ambyte_files_invalid_upload_dir(self):
        """Test handling of invalid upload directory name."""
        files_data = [
            {
                'content': 'I1\t4039\t1748882921\nA\t27306\t44136\nT0\t26870\nT1\t192,208\nT2\t6580,7369\nmore\nlines\nhere\nEOF',
                'file_path': '/path/invalid_dir/Ambyte_1/1/file.txt',
                'ambit_index': '1'
            }
        ]
        
        with patch('builtins.print'):
            result = prepare_ambyte_files(files_data, 'invalid_dir', 'Ambyte_1')
        
        # Should still organize files even if upload time parsing fails
        self.assertIsNotNone(result)
        files_per_byte, upload_time, folder_name = result
        
        self.assertGreater(len(files_per_byte[0]), 0)
        self.assertIsNone(upload_time)  # Upload time should be None due to invalid format
        self.assertEqual(folder_name, 'Ambyte_1')


class TestErrorHandling(unittest.TestCase):
    """Test error handling and edge cases."""
    
    def test_parse_upload_time_with_unicode_input(self):
        """Test parse_upload_time with unicode characters."""
        with patch('builtins.print'):
            result = parse_upload_time('üplöad_20250901_01')
        
        self.assertIsNone(result)
    
    def test_prepare_ambyte_files_exception_handling(self):
        """Test that exceptions in prepare_ambyte_files are handled gracefully."""
        files_data = [
            {
                'content': 'valid\ncontent\nwith\nmultiple\nlines\nhere\nmore\nlines\nEOF',
                'file_path': '/path/upload_20250901_01/Ambyte_1/1/file.txt',
                'ambit_index': '1'
            }
        ]
        
        # Mock parse_upload_time to raise an exception
        with patch('volume_io.parse_upload_time', side_effect=Exception("Test error")):
            with patch('builtins.print'):
                result = prepare_ambyte_files(files_data, 'upload_20250901_01', 'Ambyte_1')
        
        # Should return None when exception occurs
        self.assertIsNone(result)


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)
