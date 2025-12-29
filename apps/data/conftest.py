"""
Pytest configuration and fixtures for data package tests

Mock py_mini_racer and rpy2 since they require system dependencies (V8, R)
that may not be available in all test environments.
"""
import sys
import os
from unittest.mock import MagicMock, Mock
import json
import pytest

# Add src/lib to Python path so tests can import packages
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'lib'))


# ============================================================================
# PYTEST FIXTURES
# ============================================================================
@pytest.fixture(scope="session")
def spark():
    """Create a mocked SparkSession for testing"""
    return MockSparkSession()


# ============================================================================
# PY_MINI_RACER MOCK - JavaScript executor
# ============================================================================
class MockMiniRacer:
    """Mock for py_mini_racer.MiniRacer JavaScript engine"""
    def __init__(self):
        self._context = {}
    
    def eval(self, code: str):
        """Mock eval - return JSON strings for realistic behavior"""
        # Check if this is trying to execute a JavaScript macro
        if 'function executeMacro()' in code or 'JSON.stringify' in code:
            # Return a JSON string like real V8 would
            return json.dumps({'output': [2, 4, 6], 'time': 100})
        
        # For simple expressions, return the code itself
        if 'return' in code and '{' not in code:
            return code.strip()
        
        # Default: return a simple JSON string
        return json.dumps({'result': 'ok'})
    
    def call(self, func_name: str, *args):
        """Mock function call"""
        return json.dumps({'output': list(args), 'function': func_name})


mock_py_mini_racer = MagicMock()
mock_py_mini_racer.MiniRacer = MockMiniRacer


# ============================================================================
# RPY2 MOCK - R executor
# ============================================================================
class MockR:
    """Mock for R code execution"""
    def __call__(self, code: str):
        """Mock R code execution - returns JSON string"""
        # Return different things based on what's being accessed
        if 'output' in code and '=' not in code:
            # Accessing output variable
            return json.dumps([1, 2, 3])
        return None


class MockListVector:
    """Mock for rpy2.robjects.ListVector"""
    def __init__(self, data):
        self.data = data


class MockGlobalEnv(dict):
    """Mock for R global environment"""
    pass


class MockConversion:
    """Mock for rpy2 conversion module"""
    @staticmethod
    def localconverter(converter):
        """Mock localconverter context manager"""
        class MockContext:
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
        return MockContext()
    
    @staticmethod
    def rpy2py(obj):
        """Mock rpy2py conversion"""
        if isinstance(obj, str):
            try:
                return json.loads(obj)
            except:
                return {'value': obj}
        return obj


class MockConverter:
    """Mock converter object"""
    def __add__(self, other):
        return self


class MockRobjects:
    """Mock for rpy2.robjects"""
    r = MockR()
    ListVector = MockListVector
    globalenv = MockGlobalEnv()
    conversion = MockConversion()
    default_converter = MockConverter()
    
    class pandas2ri:
        """Mock pandas2ri converter"""
        converter = MockConverter()
        
        @staticmethod
        def activate():
            pass


class MockRCallbacks:
    """Mock for rpy2.rinterface_lib.callbacks"""
    class logging:
        ERROR = 40
    
    class logger:
        @staticmethod
        def setLevel(level):
            pass


mock_rpy2 = MagicMock()
mock_rpy2.robjects = MockRobjects()
mock_rpy2_robjects = mock_rpy2.robjects
mock_rpy2_callbacks = Mock()
mock_rpy2_callbacks.logger = MockRCallbacks.logger
mock_rpy2_callbacks.logging = MockRCallbacks.logging


# ============================================================================
# PYSPARK MOCK - Spark DataFrame and Session
# ============================================================================
class MockSparkDataFrame:
    """Mock for PySpark DataFrame"""
    def __init__(self, data=None, schema=None):
        self._data = data if data is not None else []
        self._schema = schema
        self.columns = schema if isinstance(schema, list) else []
    
    def toPandas(self):
        """Convert to pandas DataFrame"""
        import pandas as pd
        if not self._data:
            return pd.DataFrame()
        return pd.DataFrame(self._data, columns=self.columns if self.columns else None)
    
    def limit(self, n):
        """Return a new DataFrame with limited rows"""
        limited_data = self._data[:n] if self._data else []
        return MockSparkDataFrame(limited_data, self._schema)
    
    def select(self, *cols):
        """Mock select operation"""
        return MockSparkDataFrame(self._data, self._schema)
    
    def filter(self, condition):
        """Mock filter operation"""
        return MockSparkDataFrame(self._data, self._schema)
    
    def withColumn(self, colName, col):
        """Mock withColumn operation"""
        return MockSparkDataFrame(self._data, self._schema)
    
    def withColumnRenamed(self, existing, new):
        """Mock withColumnRenamed operation"""
        return MockSparkDataFrame(self._data, self._schema)
    
    def join(self, other, on=None, how='inner'):
        """Mock join operation"""
        return MockSparkDataFrame(self._data, self._schema)
    
    def groupBy(self, *cols):
        """Mock groupBy operation"""
        return MockGroupedData(self)
    
    def drop(self, *cols):
        """Mock drop operation"""
        return MockSparkDataFrame(self._data, self._schema)
    
    def count(self):
        """Return count of rows"""
        return len(self._data) if self._data else 0
    
    def collect(self):
        """Mock collect - returns list of Row objects"""
        return [MockRow(dict(zip(self.columns, row))) for row in self._data] if self._data else []
    
    def createOrReplaceTempView(self, name):
        """Mock createOrReplaceTempView"""
        pass


class MockRow:
    """Mock for PySpark Row"""
    def __init__(self, data):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)
    
    def asDict(self):
        return self._data


class MockGroupedData:
    """Mock for PySpark GroupedData"""
    def __init__(self, df):
        self._df = df
    
    def agg(self, *exprs):
        """Mock aggregation"""
        return self._df


class MockSparkSession:
    """Mock for SparkSession"""
    class Builder:
        def __init__(self):
            self._config = {}
        
        def master(self, master):
            self._config['master'] = master
            return self
        
        def appName(self, name):
            self._config['appName'] = name
            return self
        
        def config(self, key, value):
            self._config[key] = value
            return self
        
        def getOrCreate(self):
            return MockSparkSession()
    
    builder = Builder()
    
    def __init__(self):
        self.read = MockDataFrameReader()
    
    def table(self, tableName):
        """Mock table read - returns empty DataFrame"""
        return MockSparkDataFrame([], [])
    
    def createDataFrame(self, data, schema=None):
        """Mock createDataFrame"""
        return MockSparkDataFrame(data, schema)
    
    def stop(self):
        """Mock stop"""
        pass


class MockDataFrameReader:
    """Mock for DataFrameReader"""
    def table(self, tableName):
        """Mock table read"""
        return MockSparkDataFrame([], [])


class MockColumn:
    """Mock for PySpark Column"""
    def __init__(self, name):
        self._name = name
    
    def alias(self, alias):
        return MockColumn(alias)
    
    def isNull(self):
        return MockColumn(f"{self._name}_is_null")
    
    def isNotNull(self):
        return MockColumn(f"{self._name}_is_not_null")
    
    def cast(self, dataType):
        return MockColumn(f"{self._name}_cast")


class MockFunctions:
    """Mock for pyspark.sql.functions"""
    @staticmethod
    def col(name):
        return MockColumn(name)
    
    @staticmethod
    def lit(value):
        return MockColumn(str(value))
    
    @staticmethod
    def when(condition, value):
        return MockColumn("when_expr")
    
    @staticmethod
    def coalesce(*cols):
        return MockColumn("coalesce")
    
    @staticmethod
    def array(*cols):
        return MockColumn("array")
    
    @staticmethod
    def concat(*cols):
        return MockColumn("concat")
    
    @staticmethod
    def explode(col):
        return MockColumn("explode")
    
    @staticmethod
    def size(col):
        return MockColumn("size")
    
    @staticmethod
    def struct(*cols):
        return MockColumn("struct")
    
    @staticmethod
    def collect_list(col):
        return MockColumn("collect_list")
    
    @staticmethod
    def pandas_udf(returnType=None, functionType=None):
        """Mock pandas_udf decorator"""
        def decorator(func):
            # Return the function unchanged for testing
            return func
        return decorator


class MockTypes:
    """Mock for pyspark.sql.types"""
    class DataType:
        pass
    
    class StringType(DataType):
        def __init__(self):
            pass
    
    class StructType(DataType):
        def __init__(self, fields=None):
            self.fields = fields or []
    
    class StructField:
        def __init__(self, name, dataType, nullable=True):
            self.name = name
            self.dataType = dataType
            self.nullable = nullable
    
    class ArrayType(DataType):
        def __init__(self, elementType, containsNull=True):
            self.elementType = elementType
            self.containsNull = containsNull
    
    class TimestampType(DataType):
        def __init__(self):
            pass
    
    class IntegerType(DataType):
        def __init__(self):
            pass
    
    class DoubleType(DataType):
        def __init__(self):
            pass
    
    class BooleanType(DataType):
        def __init__(self):
            pass
    
    class MapType(DataType):
        def __init__(self, keyType, valueType, valueContainsNull=True):
            self.keyType = keyType
            self.valueType = valueType
            self.valueContainsNull = valueContainsNull


# Create mock modules
mock_pyspark_sql = MagicMock()
mock_pyspark_sql.SparkSession = MockSparkSession
mock_pyspark_sql.DataFrame = MockSparkDataFrame
mock_pyspark_sql.Row = MockRow
mock_pyspark_sql.functions = MockFunctions
mock_pyspark_sql.types = MockTypes()

# Add individual type exports
for type_name in ['StringType', 'StructType', 'StructField', 'ArrayType', 'TimestampType', 'IntegerType', 'DoubleType', 'BooleanType', 'MapType']:
    setattr(mock_pyspark_sql.types, type_name, getattr(MockTypes, type_name))


# ============================================================================
# Install mocks into sys.modules
# ============================================================================
sys.modules['py_mini_racer'] = mock_py_mini_racer
sys.modules['rpy2'] = mock_rpy2
sys.modules['rpy2.robjects'] = mock_rpy2_robjects
sys.modules['rpy2.rinterface_lib'] = MagicMock()
sys.modules['rpy2.rinterface_lib.callbacks'] = mock_rpy2_callbacks

# Install PySpark mocks
sys.modules['pyspark'] = MagicMock()
sys.modules['pyspark.sql'] = mock_pyspark_sql
sys.modules['pyspark.sql.functions'] = mock_pyspark_sql.functions
sys.modules['pyspark.sql.types'] = mock_pyspark_sql.types

