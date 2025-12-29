"""
Pytest configuration for multispeq tests

Mock py_mini_racer and rpy2 since they require system dependencies (V8, R)
that may not be available in all test environments.
"""
import sys
from unittest.mock import MagicMock
import json


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


# ============================================================================
# Install mocks into sys.modules
# ============================================================================
mock_py_mini_racer = MagicMock()
mock_py_mini_racer.MiniRacer = MockMiniRacer

mock_rpy2 = MagicMock()
mock_rpy2.robjects = MockRobjects()
mock_rpy2_robjects = mock_rpy2.robjects
mock_rpy2_callbacks = MagicMock()
mock_rpy2_callbacks.logger = MockRCallbacks.logger
mock_rpy2_callbacks.logging = MockRCallbacks.logging

sys.modules['py_mini_racer'] = mock_py_mini_racer
sys.modules['rpy2'] = mock_rpy2
sys.modules['rpy2.robjects'] = mock_rpy2_robjects
sys.modules['rpy2.rinterface_lib'] = MagicMock()
sys.modules['rpy2.rinterface_lib.callbacks'] = mock_rpy2_callbacks
