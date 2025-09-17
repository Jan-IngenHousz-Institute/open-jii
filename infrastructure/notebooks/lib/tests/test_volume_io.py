"""
Unit tests for volume_io.py module.

Tests cover all functions including find_upload_directories, parse_upload_time,
and discover_and_validate_upload_directories.
"""

import os
import unittest
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock
from volume_io import find_upload_directories, parse_upload_time, discover_and_validate_upload_directories


class TestFindUploadDirectories(unittest.TestCase):
    """Test find_upload_directories function."""
    
    @patch('os.path.exists')
    @patch('os.listdir')
    @patch('os.path.isdir')
    def test_find_upload_directories_success(self, mock_isdir, mock_listdir, mock_exists):
        """Test successful discovery of upload directories."""
        mock_exists.return_value = True
        mock_listdir.return_value = [
            'upload_20250901_01',
            'upload_20250902_02', 
            'other_folder',
            'upload_20250903_03',
            'regular_file.txt'
        ]
        
        def mock_isdir_side_effect(path):
            # Only upload directories and other_folder are directories
            return any(folder in path for folder in ['upload_20250901_01', 'upload_20250902_02', 'upload_20250903_03', 'other_folder'])
        
        mock_isdir.side_effect = mock_isdir_side_effect
        
        result = find_upload_directories('/test/base/path')
        
        expected = [
            '/test/base/path/upload_20250901_01',
            '/test/base/path/upload_20250902_02',
            '/test/base/path/upload_20250903_03'
        ]
        
        self.assertEqual(result, expected)
        mock_exists.assert_called_once_with('/test/base/path')
        mock_listdir.assert_called_once_with('/test/base/path')
    
    @patch('os.path.exists')
    def test_find_upload_directories_path_not_exists(self, mock_exists):
        """Test when base path doesn't exist."""
        mock_exists.return_value = False
        
        result = find_upload_directories('/nonexistent/path')
        
        self.assertEqual(result, [])
        mock_exists.assert_called_once_with('/nonexistent/path')
    
    @patch('os.path.exists')
    @patch('os.listdir')
    def test_find_upload_directories_empty_directory(self, mock_listdir, mock_exists):
        """Test with empty directory."""
        mock_exists.return_value = True
        mock_listdir.return_value = []
        
        result = find_upload_directories('/test/empty/path')
        
        self.assertEqual(result, [])
    
    @patch('os.path.exists')
    @patch('os.listdir')
    @patch('os.path.isdir')
    def test_find_upload_directories_no_upload_dirs(self, mock_isdir, mock_listdir, mock_exists):
        """Test when no upload directories are found."""
        mock_exists.return_value = True
        mock_listdir.return_value = ['other_folder', 'regular_file.txt', 'another_dir']
        mock_isdir.return_value = True
        
        result = find_upload_directories('/test/path')
        
        self.assertEqual(result, [])
    
    @patch('os.path.exists')
    @patch('os.listdir')
    @patch('os.path.isdir')
    def test_find_upload_directories_mixed_items(self, mock_isdir, mock_listdir, mock_exists):
        """Test with mix of files and directories, some upload dirs."""
        mock_exists.return_value = True
        mock_listdir.return_value = [
            'upload_20250801_01',  # directory
            'upload_20250802_02',  # file (should be ignored)
            'not_upload_dir',      # directory
            'upload_invalid',      # directory but wrong format (should be ignored)
            'upload_20250803_03'   # directory
        ]
        
        def mock_isdir_side_effect(path):
            files = ['upload_20250802_02']  # This one is a file
            return not any(f in path for f in files)
        
        mock_isdir.side_effect = mock_isdir_side_effect
        
        result = find_upload_directories('/test/path')
        
        # The function filters by startswith("upload_"), so 'upload_invalid' will be included
        # but it still has the correct upload_ prefix, just not a valid date format
        expected = [
            '/test/path/upload_20250801_01',
            '/test/path/upload_invalid',
            '/test/path/upload_20250803_03'
        ]
        
        self.assertEqual(result, expected)
    
    @patch('os.path.exists')
    @patch('os.listdir')
    def test_find_upload_directories_os_error(self, mock_listdir, mock_exists):
        """Test handling of OS errors during directory listing."""
        mock_exists.return_value = True
        mock_listdir.side_effect = OSError("Permission denied")
        
        with patch('builtins.print') as mock_print:
            result = find_upload_directories('/restricted/path')
        
        self.assertEqual(result, [])
        mock_print.assert_called_once()
        self.assertIn("Error accessing volume", mock_print.call_args[0][0])


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


class TestDiscoverAndValidateUploadDirectories(unittest.TestCase):
    """Test discover_and_validate_upload_directories function."""
    
    @patch('volume_io.find_upload_directories')
    def test_discover_and_validate_success(self, mock_find_upload_directories):
        """Test successful discovery and validation."""
        mock_find_upload_directories.return_value = [
            '/test/path/upload_20250901_01',
            '/test/path/upload_20250902_02'
        ]
        
        with patch('builtins.print') as mock_print:
            directories, success = discover_and_validate_upload_directories('/test/path')
        
        expected_directories = [
            '/test/path/upload_20250901_01',
            '/test/path/upload_20250902_02'
        ]
        
        self.assertEqual(directories, expected_directories)
        self.assertTrue(success)
        
        # Check that appropriate messages were printed
        print_calls = [call[0][0] for call in mock_print.call_args_list]
        self.assertTrue(any("Found 2 upload directories" in call for call in print_calls))
        self.assertTrue(any("Upload directories: ['upload_20250901_01', 'upload_20250902_02']" in call for call in print_calls))
    
    @patch('volume_io.find_upload_directories')
    def test_discover_and_validate_empty_result(self, mock_find_upload_directories):
        """Test when no upload directories are found."""
        mock_find_upload_directories.return_value = []
        
        with patch('builtins.print') as mock_print:
            directories, success = discover_and_validate_upload_directories('/test/path')
        
        self.assertEqual(directories, [])
        self.assertFalse(success)
        
        mock_print.assert_called_once_with("No upload directories found")
    
    @patch('volume_io.find_upload_directories')
    def test_discover_and_validate_single_directory(self, mock_find_upload_directories):
        """Test with single upload directory."""
        mock_find_upload_directories.return_value = ['/test/path/upload_20250901_01']
        
        with patch('builtins.print') as mock_print:
            directories, success = discover_and_validate_upload_directories('/test/path')
        
        self.assertEqual(directories, ['/test/path/upload_20250901_01'])
        self.assertTrue(success)
        
        print_calls = [call[0][0] for call in mock_print.call_args_list]
        self.assertTrue(any("Found 1 upload directories" in call for call in print_calls))
        self.assertTrue(any("Upload directories: ['upload_20250901_01']" in call for call in print_calls))
    
    @patch('volume_io.find_upload_directories')
    def test_discover_and_validate_many_directories(self, mock_find_upload_directories):
        """Test with many upload directories."""
        upload_dirs = [f'/test/path/upload_202509{i:02d}_01' for i in range(1, 11)]
        mock_find_upload_directories.return_value = upload_dirs
        
        with patch('builtins.print') as mock_print:
            directories, success = discover_and_validate_upload_directories('/test/path')
        
        self.assertEqual(directories, upload_dirs)
        self.assertTrue(success)
        
        print_calls = [call[0][0] for call in mock_print.call_args_list]
        self.assertTrue(any("Found 10 upload directories" in call for call in print_calls))


class TestIntegrationScenarios(unittest.TestCase):
    """Integration tests combining multiple functions."""
    
    @patch('os.path.exists')
    @patch('os.listdir')
    @patch('os.path.isdir')
    def test_complete_workflow_success(self, mock_isdir, mock_listdir, mock_exists):
        """Test complete workflow from directory discovery to time parsing."""
        # Setup mocks for find_upload_directories
        mock_exists.return_value = True
        mock_listdir.return_value = [
            'upload_20250901_01',
            'upload_20250902_02',
            'other_folder',
            'upload_20250903_03'
        ]
        mock_isdir.return_value = True
        
        # Test the complete workflow
        with patch('builtins.print'):
            directories, success = discover_and_validate_upload_directories('/test/path')
        
        self.assertTrue(success)
        self.assertEqual(len(directories), 3)
        
        # Test parsing upload times for discovered directories
        for directory in directories:
            dir_name = os.path.basename(directory)
            upload_time = parse_upload_time(dir_name)
            self.assertIsNotNone(upload_time)
            self.assertIsInstance(upload_time, datetime)
    
    @patch('os.path.exists')
    @patch('os.listdir')
    def test_complete_workflow_with_os_error(self, mock_listdir, mock_exists):
        """Test complete workflow when OS errors occur."""
        mock_exists.return_value = True
        mock_listdir.side_effect = PermissionError("Access denied")
        
        with patch('builtins.print'):
            directories, success = discover_and_validate_upload_directories('/restricted/path')
        
        self.assertFalse(success)
        self.assertEqual(directories, [])
    
    def test_date_parsing_edge_cases_integration(self):
        """Test date parsing with various edge cases in integration context."""
        test_cases = [
            ('upload_20250101_01', True),   # New Year's Day
            ('upload_20251231_99', True),   # New Year's Eve
            ('upload_20240229_01', True),   # Leap year
            ('upload_20250229_01', False),  # Invalid leap year
            ('upload_invalid_01', False),   # Invalid format
        ]
        
        for dir_name, should_succeed in test_cases:
            with self.subTest(dir_name=dir_name):
                with patch('builtins.print'):
                    result = parse_upload_time(dir_name)
                
                if should_succeed:
                    self.assertIsNotNone(result)
                    self.assertIsInstance(result, datetime)
                else:
                    self.assertIsNone(result)


class TestErrorHandling(unittest.TestCase):
    """Test error handling and edge cases."""
    
    def test_find_upload_directories_with_unicode_names(self):
        """Test handling of unicode characters in directory names."""
        with patch('os.path.exists', return_value=True), \
             patch('os.listdir', return_value=['upload_20250901_01', 'üñíçødé_folder', 'upload_20250902_02']), \
             patch('os.path.isdir', return_value=True):
            
            result = find_upload_directories('/test/path')
            
            expected = [
                '/test/path/upload_20250901_01',
                '/test/path/upload_20250902_02'
            ]
            self.assertEqual(result, expected)
    
    def test_parse_upload_time_with_unicode_input(self):
        """Test parse_upload_time with unicode characters."""
        with patch('builtins.print'):
            result = parse_upload_time('üplöad_20250901_01')
        
        self.assertIsNone(result)
    
    @patch('volume_io.find_upload_directories')
    def test_discover_and_validate_with_none_result(self, mock_find_upload_directories):
        """Test when find_upload_directories returns unexpected None (defensive)."""
        mock_find_upload_directories.return_value = None
        
        with patch('builtins.print') as mock_print:
            directories, success = discover_and_validate_upload_directories('/test/path')
            
            # The function treats None as falsy, so it returns empty list and False
            self.assertEqual(directories, [])
            self.assertFalse(success)
            
            # Should print "No upload directories found" message
            mock_print.assert_called_once_with("No upload directories found")


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)
