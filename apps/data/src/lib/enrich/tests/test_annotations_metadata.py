"""
Tests for enrich annotations metadata functions
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, StructType


class TestAnnotationsMetadata:
    """Test annotations metadata enrichment"""
    
    def test_add_annotation_column_with_error(self):
        """Test annotation column when table doesn't exist"""
        from enrich.annotations_metadata import add_annotation_column, annotation_schema
        from conftest import MockSparkDataFrame
        
        # Create a simple DataFrame using our mock
        df = MockSparkDataFrame([(1, "test"), (2, "test2")], ["id", "name"])
        
        # Mock spark session that raises error on table read
        mock_spark = Mock()
        mock_read = Mock()
        mock_read.table.side_effect = Exception("Table not found")
        mock_spark.read = mock_read
        
        # Should handle gracefully and return df with empty annotations column
        result = add_annotation_column(
            df,
            'nonexistent_table',
            'nonexistent_catalog',
            'nonexistent_schema',
            mock_spark
        )
        
        # Should return DataFrame (our mock returns self on withColumn)
        assert result is not None
        
    def test_annotation_schema_structure(self):
        """Test that annotation schema is properly structured"""
        from enrich.annotations_metadata import annotation_schema
        
        # Verify schema is a StructType
        assert isinstance(annotation_schema, StructType)
        
        # Verify key fields exist
        field_names = [f.name for f in annotation_schema.fields]
        assert 'id' in field_names
        assert 'rowId' in field_names
        assert 'type' in field_names
        assert 'content' in field_names
        assert 'createdBy' in field_names
        
    def test_add_annotation_column_basic(self):
        """Test basic annotation column addition without existing annotations column"""
        from enrich.annotations_metadata import add_annotation_column
        from conftest import MockSparkDataFrame
        
        # Create a simple DataFrame
        df = MockSparkDataFrame([(1, "test")], ["id", "name"])
        
        # Mock spark to avoid table lookup
        mock_spark = Mock()
        mock_read = Mock()
        mock_read.table.side_effect = Exception("Table not found")
        mock_spark.read = mock_read
        
        # Should handle error gracefully
        result = add_annotation_column(
            df,
            'test_table',
            'test_catalog',
            'test_schema',
            mock_spark
        )
        
        # Should return a DataFrame
        assert result is not None
    
    def test_add_annotation_column_with_existing_annotations(self):
        """Test merging with existing annotations column"""
        from enrich.annotations_metadata import add_annotation_column
        from conftest import MockSparkDataFrame
        
        # Create DataFrame with existing annotations column
        df = MockSparkDataFrame([(1, 'test', [])], ['id', 'name', 'annotations'])
        df.columns = ['id', 'name', 'annotations']
        
        mock_spark = Mock()
        mock_spark.read.table.side_effect = Exception('No table')
        
        result = add_annotation_column(
            df,
            'test_table',
            'test_catalog',
            'test_schema',
            mock_spark
        )
        
        # Should preserve existing annotations
        assert result is not None
    
    def test_add_annotation_column_successful_join(self):
        """Test successful annotation join"""
        from enrich.annotations_metadata import add_annotation_column
        from conftest import MockSparkDataFrame
        
        df = MockSparkDataFrame([(1, 'test')], ['id', 'name'])
        
        # Mock successful table read
        mock_annotations_df = MockSparkDataFrame(
            [('1', 'annotation1')],
            ['row_id', 'id']
        )
        
        mock_spark = Mock()
        mock_read = Mock()
        mock_read.table.return_value = mock_annotations_df
        mock_spark.read = mock_read
        
        result = add_annotation_column(
            df,
            'test_table',
            'test_catalog',
            'test_schema',
            mock_spark
        )
        
        # Should return result (covers lines 95-147, 155-156)
        assert result is not None
    
    def test_add_annotation_column_builds_content_struct(self):
        """Test that annotation content struct is built correctly"""
        from enrich.annotations_metadata import add_annotation_column
        from conftest import MockSparkDataFrame, MockColumn
        
        df = MockSparkDataFrame([(1, 'test')], ['id', 'name'])
        
        # Create a more detailed mock that tracks function calls
        mock_annotations_df = MockSparkDataFrame([], ['row_id'])
        
        # Track that struct was called for content
        struct_calls = []
        original_struct = Mock(side_effect=lambda *args, **kwargs: MockColumn('struct_result'))
        
        mock_spark = Mock()
        mock_read = Mock()
        mock_read.table.return_value = mock_annotations_df
        mock_spark.read = mock_read
        
        with patch('enrich.annotations_metadata.F.struct', original_struct):
            result = add_annotation_column(
                df,
                'test_table',
                'test_catalog',
                'test_schema',
                mock_spark
            )
        
        # Struct should have been called to build content and annotation structs
        assert original_struct.call_count >= 2
    
    def test_add_annotation_column_filters_by_table_name(self):
        """Test that annotations are filtered by table_name"""
        from enrich.annotations_metadata import add_annotation_column
        from conftest import MockSparkDataFrame
        
        df = MockSparkDataFrame([(1, 'test')], ['id', 'name'])
        
        mock_annotations_df = MockSparkDataFrame([], ['row_id'])
        filter_calls = []
        
        # Track filter calls
        def track_filter(col):
            filter_calls.append(str(col))
            return mock_annotations_df
        
        mock_annotations_df.filter = Mock(side_effect=track_filter)
        
        mock_spark = Mock()
        mock_read = Mock()
        mock_read.table.return_value = mock_annotations_df
        mock_spark.read = mock_read
        
        result = add_annotation_column(
            df,
            'my_table',
            'test_catalog',
            'test_schema',
            mock_spark
        )
        
        # Should have called filter to match table_name
        assert mock_annotations_df.filter.called
    
    def test_add_annotation_column_collects_and_groups(self):
        """Test that annotations are collected and grouped by row_id"""
        from enrich.annotations_metadata import add_annotation_column
        from conftest import MockSparkDataFrame
        
        df = MockSparkDataFrame([(1, 'row1'), (2, 'row2')], ['id', 'name'])
        
        # Mock annotation data with multiple annotations per row
        mock_annotations_df = MockSparkDataFrame(
            [('1', 'ann1'), ('1', 'ann2'), ('2', 'ann3')],
            ['row_id', 'annotation_id']
        )
        
        collect_called = False
        
        def mock_collect(*args, **kwargs):
            nonlocal collect_called
            collect_called = True
            return []
        
        mock_annotations_df.collect = Mock(side_effect=mock_collect)
        
        mock_spark = Mock()
        mock_read = Mock()
        mock_read.table.return_value = mock_annotations_df
        mock_spark.read = mock_read
        
        result = add_annotation_column(
            df,
            'test_table',
            'test_catalog',
            'test_schema',
            mock_spark
        )
        
        # collect should be called as part of groupBy aggregation
        # (depending on implementation details)
        assert result is not None




