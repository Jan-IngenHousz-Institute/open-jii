"""
Pytest configuration for ambyte tests

Mock PySpark and DBUtils for Databricks-specific functionality
"""
import sys
from unittest.mock import MagicMock, Mock
import pytest


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


class MockDBUtils:
    """Mock for Databricks DBUtils"""
    def __init__(self, spark=None):
        self.widgets = MockWidgets()
        self.fs = MockFileSystem()
        self.notebook = MockNotebook()


class MockWidgets:
    """Mock for DBUtils widgets"""
    def __init__(self):
        self._widgets = {}
    
    def get(self, key, default=None):
        """Get widget value"""
        return self._widgets.get(key, default)
    
    def text(self, name, defaultValue, label=None):
        """Create text widget"""
        self._widgets[name] = defaultValue


class MockFileSystem:
    """Mock for DBUtils fs"""
    def ls(self, path):
        """List files in path"""
        return []
    
    def mkdirs(self, path):
        """Create directory"""
        return True
    
    def rm(self, path, recurse=False):
        """Remove file or directory"""
        return True
    
    def cp(self, src, dest, recurse=False):
        """Copy file or directory"""
        return True


class MockNotebook:
    """Mock for DBUtils notebook"""
    def run(self, path, timeout_seconds=60, arguments=None):
        """Run another notebook"""
        return ""
    
    def exit(self, value):
        """Exit notebook with value"""
        raise SystemExit(value)


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


# ============================================================================
# PYTEST FIXTURES
# ============================================================================
@pytest.fixture(scope="session")
def spark():
    """Create a mocked SparkSession for testing"""
    return MockSparkSession()


# ============================================================================
# Install mocks into sys.modules
# ============================================================================
mock_pyspark_sql = MagicMock()
mock_pyspark_sql.SparkSession = MockSparkSession
mock_pyspark_sql.DataFrame = MockSparkDataFrame
mock_pyspark_sql.Row = MockRow
mock_pyspark_sql.functions = MockFunctions
mock_pyspark_sql.types = MockTypes()

# Add individual type exports
for type_name in ['StringType', 'StructType', 'StructField', 'ArrayType', 'TimestampType', 'IntegerType', 'DoubleType', 'BooleanType', 'MapType']:
    setattr(mock_pyspark_sql.types, type_name, getattr(MockTypes, type_name))

# Install PySpark mocks
sys.modules['pyspark'] = MagicMock()
sys.modules['pyspark.sql'] = mock_pyspark_sql
sys.modules['pyspark.sql.functions'] = mock_pyspark_sql.functions
sys.modules['pyspark.sql.types'] = mock_pyspark_sql.types

# Install DBUtils mock
mock_pyspark_dbutils = MagicMock()
mock_pyspark_dbutils.DBUtils = MockDBUtils
sys.modules['pyspark.dbutils'] = mock_pyspark_dbutils
