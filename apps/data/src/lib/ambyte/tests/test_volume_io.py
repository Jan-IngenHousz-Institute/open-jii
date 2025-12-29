"""
Tests for ambyte volume I/O functions
"""
import pytest
import os
from unittest.mock import Mock, patch
from datetime import datetime

from ambyte.volume_io import (
    find_upload_directories,
    parse_upload_time,
    discover_and_validate_upload_directories
)


class TestFindUploadDirectories:
    """Test find_upload_directories function"""
    
    @patch('os.path.exists')
    @patch('os.listdir')
    @patch('os.path.isdir')
    def test_find_upload_directories_success(self, mock_isdir, mock_listdir, mock_exists):
        """Test finding upload directories successfully"""
        mock_exists.return_value = True
        mock_listdir.return_value = ['upload_20250901_01', 'upload_20250902_01', 'other_dir']
        mock_isdir.side_effect = lambda p: 'upload_' in p
        
        result = find_upload_directories('/base/path')
        
        assert len(result) == 2
        assert '/base/path/upload_20250901_01' in result
        assert '/base/path/upload_20250902_01' in result
    
    @patch('os.path.exists')
    def test_find_upload_directories_no_base_path(self, mock_exists):
        """Test when base path doesn't exist"""
        mock_exists.return_value = False
        
        result = find_upload_directories('/nonexistent')
        
        assert result == []
    
    @patch('os.path.exists')
    @patch('os.listdir')
    def test_find_upload_directories_exception(self, mock_listdir, mock_exists):
        """Test handling exception when accessing directories"""
        mock_exists.return_value = True
        mock_listdir.side_effect = PermissionError("Access denied")
        
        result = find_upload_directories('/restricted')
        
        assert result == []
    
    @patch('os.path.exists')
    @patch('os.listdir')
    @patch('os.path.isdir')
    def test_find_upload_directories_empty(self, mock_isdir, mock_listdir, mock_exists):
        """Test when no upload directories exist"""
        mock_exists.return_value = True
        mock_listdir.return_value = ['other1', 'other2']
        mock_isdir.return_value = True
        
        result = find_upload_directories('/base/path')
        
        assert result == []


class TestParseUploadTime:
    """Test parse_upload_time function"""
    
    def test_parse_upload_time_valid(self):
        """Test parsing valid upload directory name"""
        result = parse_upload_time('upload_20250901_01')
        
        assert result is not None
        assert result.year == 2025
        assert result.month == 9
        assert result.day == 1
    
    def test_parse_upload_time_invalid_format(self):
        """Test parsing invalid directory name format"""
        result = parse_upload_time('invalid_format')
        
        assert result is None
    
    def test_parse_upload_time_wrong_prefix(self):
        """Test parsing directory without upload_ prefix"""
        result = parse_upload_time('other_20250901_01')
        
        assert result is None
    
    def test_parse_upload_time_malformed_date(self):
        """Test parsing with malformed date"""
        result = parse_upload_time('upload_invalid_01')
        
        assert result is None
    
    def test_parse_upload_time_exception(self):
        """Test handling exception during parsing"""
        result = parse_upload_time('upload_99999999_01')
        
        assert result is None


class TestDiscoverAndValidateUploadDirectories:
    """Test discover_and_validate_upload_directories function"""
    
    @patch('ambyte.volume_io.find_upload_directories')
    def test_discover_and_validate_success(self, mock_find):
        """Test successful discovery and validation"""
        mock_find.return_value = ['/base/upload_20250901_01', '/base/upload_20250902_01']
        
        dirs, success = discover_and_validate_upload_directories('/base')
        
        assert success is True
        assert len(dirs) == 2
    
    @patch('ambyte.volume_io.find_upload_directories')
    def test_discover_and_validate_no_directories(self, mock_find):
        """Test when no directories are found"""
        mock_find.return_value = []
        
        dirs, success = discover_and_validate_upload_directories('/base')
        
        assert success is False
        assert dirs == []


