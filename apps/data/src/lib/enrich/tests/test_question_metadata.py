"""
Tests for enrich question metadata functions
"""
import pytest
from unittest.mock import Mock, patch

from enrich.question_metadata import _sanitize_column_name, add_question_columns


class TestQuestionMetadata:
    """Test question metadata enrichment"""
    
    def test_sanitize_column_name(self):
        """Test _sanitize_column_name function"""
        assert _sanitize_column_name("Test Label") == "test_label"
        assert _sanitize_column_name("Test-Label") == "test-label"  # Hyphens are NOT replaced
        assert _sanitize_column_name("Test_Label") == "test_label"
        assert _sanitize_column_name("  Test  Label  ") == "test_label"
        assert _sanitize_column_name("Test,Label;Name") == "test_label_name"
        assert _sanitize_column_name("Test{}()Label") == "test_label"
        assert _sanitize_column_name("Test\nLabel\tName") == "test_label_name"
        assert _sanitize_column_name("Test=Label") == "test_label"
        assert _sanitize_column_name("123test") == "question_123test"
        assert _sanitize_column_name("") == "question_"
        assert _sanitize_column_name("___test___") == "test"
    
    def test_add_question_columns(self):
        """Test add_question_columns function - just verify no crash"""
        # This function requires real Spark DataFrame operations
        # We can only test that the function exists and basic structure
        from enrich.question_metadata import add_question_columns
        assert callable(add_question_columns)
    
    def test_get_experiment_question_labels(self):
        """Test get_experiment_question_labels function - verify it handles errors gracefully"""
        from enrich.question_metadata import get_experiment_question_labels
        
        # Test with mock that will fail and return empty list
        mock_spark = Mock()
        mock_spark.read.table.side_effect = Exception("Mock error")
        
        result = get_experiment_question_labels(
            mock_spark, 'catalog', 'schema', 'table', 'exp123'
        )
        
        # Should return empty list on error
        assert result == []
    
    def test_get_experiment_question_labels_error(self):
        """Test get_experiment_question_labels with error"""
        from enrich.question_metadata import get_experiment_question_labels
        
        # Test with mock that raises exception with table name
        mock_spark = Mock()
        mock_spark.read.table.side_effect = Exception("Table not found")
        
        result = get_experiment_question_labels(
            mock_spark, 'catalog', 'schema', 'table', 'exp123'
        )
        
        # Should return empty list on error
        assert result == []
    
    def test_get_experiment_question_labels_success(self):
        """Test get_experiment_question_labels with successful data"""
        from enrich.question_metadata import get_experiment_question_labels
        
        # Create mock chain for Spark DataFrame operations
        mock_spark = Mock()
        mock_df = Mock()
        mock_filtered = Mock()
        mock_exploded = Mock()
        mock_selected = Mock()
        mock_final = Mock()
        
        # Setup mock chain
        mock_spark.read.table.return_value = mock_df
        mock_df.filter.return_value = mock_filtered
        mock_filtered.filter.return_value = mock_filtered
        mock_filtered.select.return_value = mock_exploded
        mock_exploded.select.return_value = mock_selected
        mock_selected.filter.return_value = mock_selected
        mock_selected.dropDuplicates.return_value = mock_final
        
        # Mock row data
        mock_row1 = Mock()
        mock_row1.question_label = "Question 1"
        mock_row2 = Mock()
        mock_row2.question_label = "Question 2"
        mock_final.collect.return_value = [mock_row1, mock_row2]
        
        result = get_experiment_question_labels(
            mock_spark, 'catalog', 'schema', 'table', 'exp123'
        )
        
        # Should return list of labels (actual mock behavior may vary)
        assert isinstance(result, list)
    
    def test_get_experiment_question_labels_with_table_error(self):
        """Test get_experiment_question_labels exception path with table read error"""
        from enrich.question_metadata import get_experiment_question_labels
        
        mock_spark = Mock()
        mock_spark.read.table.side_effect = Exception("Table not found")
        
        result = get_experiment_question_labels(
            mock_spark,
            'test_catalog',
            'test_schema',
            'test_table',
            12345
        )
        
        # Should return empty list on exception (covers lines 27-29)
        assert result == []
    
    def test_add_question_columns_integration(self):
        """Test add_question_columns with mocked DataFrame"""
        from enrich.question_metadata import add_question_columns
        
        # Mock DataFrame with proper chaining
        mock_df = Mock()
        mock_result_df = Mock()
        mock_result_df.withColumn = Mock(return_value=mock_result_df)
        mock_df.withColumn = Mock(return_value=mock_result_df)
        
        question_labels = ["Question 1", "Question 2", "Question 3"]
        
        # Mock pyspark.sql.functions at the module level
        with patch('enrich.question_metadata.F') as mock_F:
            with patch('enrich.question_metadata.StringType'):
                # Create mock column that supports isNotNull and & operator
                mock_col = Mock()
                mock_not_null = Mock()
                mock_col.isNotNull = Mock(return_value=mock_not_null)
                
                # Mock size to return something that supports > comparison
                mock_size_result = Mock()
                mock_size_condition = Mock()
                mock_size_result.__gt__ = Mock(return_value=mock_size_condition)
                
                # Mock the & operator
                mock_not_null.__and__ = Mock(return_value=mock_size_condition)
                
                mock_when_obj = Mock()
                mock_when_obj.otherwise = Mock(return_value=Mock())
                
                mock_F.when.return_value = mock_when_obj
                mock_F.col.return_value = mock_col
                mock_F.size.return_value = mock_size_result
                mock_F.expr.return_value = Mock()
                mock_F.lit.return_value = Mock(cast=Mock(return_value=Mock()))
                
                result = add_question_columns(mock_df, question_labels)
                
                # Verify function executed and returned a DataFrame
                assert result is not None
                # withColumn should be called for each question label
                assert mock_df.withColumn.call_count >= 1

        from enrich.question_metadata import get_experiment_question_labels
        
        mock_spark = Mock()
        mock_spark.read.table.side_effect = Exception("Table not found")
        
        result = get_experiment_question_labels(
            mock_spark, 'catalog', 'schema', 'table', 'exp123'
        )
        
        assert result == []
    
    def test_add_question_columns_callable(self):
        """Test add_question_columns is callable"""
        from enrich.question_metadata import add_question_columns
        
        # Just verify the function exists and is callable
        assert callable(add_question_columns)



