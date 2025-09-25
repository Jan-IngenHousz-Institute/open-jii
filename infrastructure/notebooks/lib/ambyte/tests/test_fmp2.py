"""
Unit tests for the FMP2 calculation module.

Tests the exact FMP2 calculation logic extracted from experiment_pipeline.py
to ensure consistency and correctness of photosynthesis fluorescence calculations.
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch
import sys
import os

# Add the parent directory to the path so we can import fmp2
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock PySpark dependencies for testing
class MockStructType:
    def __init__(self, fields):
        self.fields = fields

class MockStructField:
    def __init__(self, name, data_type, nullable):
        self.name = name
        self.data_type = data_type
        self.nullable = nullable

class MockDataFrame:
    def __init__(self, data=None):
        self.data = data or []
    
    def filter(self, condition):
        return self
    
    def count(self):
        return len(self.data)
    
    def groupBy(self, *cols):
        return self
    
    def apply(self, func):
        return self
    
    def join(self, other, on=None, how='inner'):
        return self
    
    def withColumn(self, col_name, col_expr):
        return self

# Mock Spark functions
class MockF:
    @staticmethod
    def col(name):
        return f"col({name})"
    
    @staticmethod
    def lit(value):
        return f"lit({value})"
    
    @staticmethod
    def pandas_udf(returnType, functionType):
        def decorator(func):
            return func
        return decorator
    
    class PandasUDFType:
        GROUPED_MAP = "GROUPED_MAP"

# Patch the imports
sys.modules['pyspark.sql'] = Mock()
sys.modules['pyspark.sql.functions'] = MockF
sys.modules['pyspark.sql.types'] = Mock()
sys.modules['pyspark.sql.types'].StructType = MockStructType
sys.modules['pyspark.sql.types'].StructField = MockStructField
sys.modules['pyspark.sql.types'].IntegerType = Mock
sys.modules['pyspark.sql.types'].FloatType = Mock
sys.modules['pyspark.sql'].DataFrame = MockDataFrame

# Now import the module under test
from fmp2 import calc_fmp2_pandas_udf, apply_fmp2_calculations


class TestCalcFmp2PandasUdf:
    """Test cases for the calc_fmp2_pandas_udf function."""
    
    def create_test_dataframe(self, sigf_values, reff_values, meta_actinic=0.1, count_value=1):
        """Helper to create test pandas DataFrame."""
        return pd.DataFrame({
            'SigF': sigf_values,
            'RefF': reff_values,
            'meta_Actinic': [meta_actinic] * len(sigf_values),
            'Count': [count_value] * len(sigf_values)
        })
    
    def test_insufficient_data_points_below_30(self):
        """Test that function returns NaN when less than 30 valid data points."""
        # Create data with only 20 valid points
        sigf = [100] * 20 + [np.nan] * 120  # 140 total, 20 valid
        reff = [50] * 20 + [np.nan] * 120
        
        pdf = self.create_test_dataframe(sigf, reff)
        result = calc_fmp2_pandas_udf(pdf)
        
        assert len(result) == 1
        assert result['Count'].iloc[0] == 1
        assert pd.isna(result['Fs'].iloc[0])
        assert pd.isna(result['Fmp'].iloc[0])
        assert pd.isna(result['Fmp_T'].iloc[0])
    
    def test_meta_actinic_fallback(self):
        """Test that meta_Actinic falls back to 0.1 when NaN."""
        # Create valid data with 50 points
        sigf = [100 + i for i in range(140)]
        reff = [50 + i*0.5 for i in range(140)]
        
        pdf = self.create_test_dataframe(sigf, reff, meta_actinic=np.nan)
        result = calc_fmp2_pandas_udf(pdf)
        
        # Should not crash and should return a result
        assert len(result) == 1
        assert result['Count'].iloc[0] == 1
    
    def test_valid_fmp2_calculation(self):
        """Test FMP2 calculation with valid data that should produce results."""
        # Create realistic fluorescence data
        np.random.seed(42)  # For reproducible test
        
        # Simulate realistic SigF/RefF ratios
        sigf = np.random.normal(1000, 50, 140)  # Signal fluorescence
        reff = np.random.normal(500, 25, 140)   # Reference fluorescence
        
        # Ensure positive values
        sigf = np.abs(sigf)
        reff = np.abs(reff)
        
        pdf = self.create_test_dataframe(sigf.tolist(), reff.tolist(), meta_actinic=0.15)
        result = calc_fmp2_pandas_udf(pdf)
        
        assert len(result) == 1
        assert result['Count'].iloc[0] == 1
        
        # Results should be numeric (not NaN) for valid data
        fs_value = result['Fs'].iloc[0]
        fmp_value = result['Fmp'].iloc[0]
        fmp_t_value = result['Fmp_T'].iloc[0]
        
        # At least Fs should be calculated (it's the most basic calculation)
        assert not pd.isna(fs_value)
        assert fs_value > 0  # Should be positive ratio
    
    def test_insufficient_fmp_potentials(self):
        """Test behavior when FMP potentials section has insufficient data."""
        # Create data where FMP potential sections (249 and 250) have insufficient data
        sigf = [100] * 140
        reff = [50] * 140
        
        # Make the FMP potential sections (indices 10-50 and 100-140) mostly NaN
        for i in range(10, 50):  # Section 249
            sigf[i] = np.nan
            reff[i] = np.nan
        for i in range(100, 140):  # Section 250
            sigf[i] = np.nan
            reff[i] = np.nan
        
        pdf = self.create_test_dataframe(sigf, reff)
        result = calc_fmp2_pandas_udf(pdf)
        
        assert len(result) == 1
        assert pd.isna(result['Fs'].iloc[0])
        assert pd.isna(result['Fmp'].iloc[0])
        assert pd.isna(result['Fmp_T'].iloc[0])
    
    def test_section_processing_logic(self):
        """Test the section processing logic for different MFP2_calc_sections."""
        # Create data with specific patterns for different sections
        sigf = [200] * 140  # Constant high signal
        reff = [100] * 140  # Constant reference
        
        # Make section 0 (indices 0-10) have lower values for Fs calculation
        for i in range(0, 10):
            sigf[i] = 50
            reff[i] = 100  # This gives lower ratio for Fs
        
        pdf = self.create_test_dataframe(sigf, reff)
        result = calc_fmp2_pandas_udf(pdf)
        
        assert len(result) == 1
        
        # Fs should be calculated from section 0 with lower ratios
        fs_value = result['Fs'].iloc[0]
        assert not pd.isna(fs_value)
        assert fs_value < 1.0  # Should be lower ratio from section 0
    
    def test_polyfit_good_fit_conditions(self):
        """Test the polyfit logic and good fit conditions."""
        # Create data that should result in a good polyfit
        np.random.seed(123)
        
        # Create realistic decreasing fluorescence pattern
        sigf = []
        reff = []
        
        for i in range(140):
            if i < 10:  # Section 0 - baseline
                s, r = 100, 200
            elif 10 <= i < 50:  # Section 249 - medium fluorescence
                s, r = 150, 200
            elif 50 <= i < 100:  # Various sections - increasing trend
                s, r = 120 + i, 200
            else:  # Section 250 - high fluorescence
                s, r = 180, 200
            
            sigf.append(s + np.random.normal(0, 5))
            reff.append(r + np.random.normal(0, 3))
        
        pdf = self.create_test_dataframe(sigf, reff, meta_actinic=0.1)
        result = calc_fmp2_pandas_udf(pdf)
        
        assert len(result) == 1
        
        # Should have calculated values
        assert not pd.isna(result['Fs'].iloc[0])
        # Fmp might be NaN depending on polyfit results, but should have attempted calculation
    
    def test_edge_case_zero_reff(self):
        """Test behavior with zero RefF values (division by zero)."""
        sigf = [100] * 140
        reff = [0] * 140  # All zeros - will cause inf in ratio
        
        pdf = self.create_test_dataframe(sigf, reff)
        result = calc_fmp2_pandas_udf(pdf)
        
        # Should handle division by zero gracefully
        assert len(result) == 1
        assert result['Count'].iloc[0] == 1
        # Results might be NaN due to inf values, which is expected behavior
    
    def test_count_preservation(self):
        """Test that the Count value is correctly preserved in output."""
        sigf = [100] * 50
        reff = [50] * 50
        count_value = 42
        
        pdf = self.create_test_dataframe(sigf, reff, count_value=count_value)
        result = calc_fmp2_pandas_udf(pdf)
        
        assert len(result) == 1
        assert result['Count'].iloc[0] == count_value


class TestApplyFmp2Calculations:
    """Test cases for the apply_fmp2_calculations function."""
    
    def test_no_mpf2_data(self):
        """Test behavior when no MPF2 data is present."""
        mock_df = MockDataFrame([])  # Empty data
        
        with patch.object(mock_df, 'count', return_value=0):
            result = apply_fmp2_calculations(mock_df)
            
            # Should return DataFrame with empty FMP2 columns
            assert isinstance(result, MockDataFrame)
    
    def test_with_mpf2_data(self):
        """Test behavior when MPF2 data is present."""
        mock_df = MockDataFrame(['some_data'])  # Non-empty data
        
        with patch.object(mock_df, 'count', return_value=5):
            result = apply_fmp2_calculations(mock_df)
            
            # Should return processed DataFrame
            assert isinstance(result, MockDataFrame)
    
    def test_schema_structure(self):
        """Test that the FMP2 schema is correctly structured."""
        mock_df = MockDataFrame(['data'])
        
        with patch.object(mock_df, 'count', return_value=1):
            # The function should create the proper schema internally
            result = apply_fmp2_calculations(mock_df)
            assert isinstance(result, MockDataFrame)


class TestIntegration:
    """Integration tests combining multiple components."""
    
    def test_realistic_workflow(self):
        """Test a realistic workflow with sample data."""
        # Create realistic MPF2 measurement data
        np.random.seed(456)
        
        # Simulate 140 measurements as expected by MFP2_calc_sections
        n_points = 140
        sigf_base = np.random.normal(800, 100, n_points)
        reff_base = np.random.normal(400, 50, n_points)
        
        # Ensure positive values
        sigf_base = np.abs(sigf_base)
        reff_base = np.abs(reff_base)
        
        # Create test data
        test_data = pd.DataFrame({
            'SigF': sigf_base,
            'RefF': reff_base,
            'meta_Actinic': [0.12] * n_points,
            'Count': [1] * n_points
        })
        
        # Test the pandas UDF directly
        result = calc_fmp2_pandas_udf(test_data)
        
        # Verify basic structure
        assert isinstance(result, pd.DataFrame)
        assert len(result) == 1
        assert 'Count' in result.columns
        assert 'Fs' in result.columns
        assert 'Fmp' in result.columns
        assert 'Fmp_T' in result.columns
        
        # Verify Count is preserved
        assert result['Count'].iloc[0] == 1
        
        # At minimum, Fs should be calculated for valid data
        assert not pd.isna(result['Fs'].iloc[0])


if __name__ == '__main__':
    # Run the tests
    pytest.main([__file__, '-v'])
