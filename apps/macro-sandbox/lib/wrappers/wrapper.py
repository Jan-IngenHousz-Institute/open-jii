import sys
import json
import traceback
import os
import signal
import textwrap
import types

# 1. SETUP PATHS
# Add src/helpers to path
current_dir = os.path.dirname(os.path.abspath(__file__))
helpers_path = os.path.join(current_dir, "../src/helpers")
sys.path.insert(0, helpers_path)

# Import helper functions
try:
    from helpers import (
        MathROUND, MathMEAN, MathMAX, MathMIN, 
        GetProtocolByLabel, ArrayNth, TransformTrace, danger
    )
    import numpy as np
    import pandas as pd
    import scipy
except ImportError as e:
    print(json.dumps({"status": "error", "results": [], "errors": [f"Helper import failed: {e}"]}))
    sys.exit(0)

# Paths passed as command-line arguments from Lambda handler
if len(sys.argv) < 3:
    print("Usage: python_wrapper.py <script_path> <input_json_path>")
    sys.exit(1)

script_path = sys.argv[1]
input_path = sys.argv[2]

# 2. READ INPUT BATCH
try:
    with open(input_path, 'r') as f:
        batch_items = json.load(f)
except Exception as e:
    print(json.dumps({"status": "error", "results": [], "errors": [f"Failed to read input: {str(e)}"]}))
    sys.exit(0)

# 3. READ USER SCRIPT
try:
    with open(script_path, 'r') as f:
        user_code_str = f.read()

    # Wrap the macro in a function to allow 'return' statements
    wrapped_code = f"""
def execute_macro():
{textwrap.indent(user_code_str, '    ')}

__macro_result__ = execute_macro()
if isinstance(__macro_result__, dict):
    output.update(__macro_result__)
"""

    # Pre-compile the script once
    compiled_code = compile(wrapped_code, script_path, 'exec')
except Exception as e:
    print(json.dumps({"status": "error", "results": [], "errors": [f"Failed to compile script: {str(e)}"]}))
    sys.exit(0)

class SafeModule:
    """Wrapper that intercepts ALL attribute access (including dot notation) to block introspection"""
    BLOCKED_ATTRS = {
        '__globals__', '__code__', '__builtins__', '__dict__', 
        '__class__', '__bases__', '__subclasses__', '__init__',
        '__loader__', '__spec__', '__package__'
    }
    
    def __init__(self, module):
        object.__setattr__(self, '_module', module)
        object.__setattr__(self, '_name', getattr(module, '__name__', 'SafeModule'))
    
    def __getattribute__(self, name):
        # Get the actual module (bypassing our own __getattribute__)
        module = object.__getattribute__(self, '_module')
        
        # Block dangerous introspection attributes
        if name in object.__getattribute__(self, 'BLOCKED_ATTRS'):
            raise AttributeError(f"access to '{name}' is restricted")
        
        # Block all other dunder attributes except safe ones
        if name.startswith('__') and name.endswith('__'):
            if name not in {'__name__', '__doc__'}:
                raise AttributeError(f"access to '{name}' is restricted")
        
        # Get the attribute from the wrapped module
        attr = getattr(module, name)
        
        # Recursively wrap submodules to prevent bypass
        if isinstance(attr, types.ModuleType):
            return SafeModule(attr)
        
        # Wrap functions and methods to block __globals__ access
        if isinstance(attr, (types.FunctionType, types.MethodType, types.BuiltinFunctionType)):
            return SafeCallable(attr)
        
        # For classes, wrap them to prevent __init__.__globals__ access
        if isinstance(attr, type):
            return SafeClass(attr)
        
        # Return primitives and safe objects as-is
        return attr
    
    def __setattr__(self, name, value):
        raise AttributeError("Cannot modify module attributes")
    
    def __repr__(self):
        module = object.__getattribute__(self, '_module')
        return f"<SafeModule({getattr(module, '__name__', 'unknown')})>"

class SafeCallable:
    """Wrapper for functions/methods to block __globals__ and other introspection"""
    BLOCKED_ATTRS = {
        '__globals__', '__code__', '__builtins__', '__dict__',
        '__closure__', '__class__', '__func__', '__self__'
    }
    
    def __init__(self, func):
        object.__setattr__(self, '_func', func)
    
    def __call__(self, *args, **kwargs):
        func = object.__getattribute__(self, '_func')
        return func(*args, **kwargs)
    
    def __getattribute__(self, name):
        if name in ('_func',):
            return object.__getattribute__(self, name)
        
        if name in object.__getattribute__(self, 'BLOCKED_ATTRS'):
            raise AttributeError(f"access to '{name}' is restricted")
        
        if name.startswith('__') and name.endswith('__'):
            if name not in {'__name__', '__doc__', '__call__'}:
                raise AttributeError(f"access to '{name}' is restricted")
        
        func = object.__getattribute__(self, '_func')
        return getattr(func, name)
    
    def __repr__(self):
        func = object.__getattribute__(self, '_func')
        return f"<SafeCallable({func.__name__ if hasattr(func, '__name__') else 'unknown'})>"

class SafeClass:
    """Wrapper for classes to prevent access to __init__.__globals__ and similar"""
    BLOCKED_ATTRS = {
        '__globals__', '__code__', '__builtins__', '__dict__',
        '__bases__', '__subclasses__', '__init__', '__class__'
    }
    
    def __init__(self, cls):
        object.__setattr__(self, '_cls', cls)
    
    def __call__(self, *args, **kwargs):
        cls = object.__getattribute__(self, '_cls')
        instance = cls(*args, **kwargs)
        return SafeInstance(instance)
    
    def __getattribute__(self, name):
        if name in ('_cls',):
            return object.__getattribute__(self, name)
        
        if name in object.__getattribute__(self, 'BLOCKED_ATTRS'):
            raise AttributeError(f"access to '{name}' is restricted")
        
        if name.startswith('__') and name.endswith('__'):
            if name not in {'__name__', '__doc__', '__call__'}:
                raise AttributeError(f"access to '{name}' is restricted")
        
        cls = object.__getattribute__(self, '_cls')
        return getattr(cls, name)
    
    def __repr__(self):
        cls = object.__getattribute__(self, '_cls')
        return f"<SafeClass({cls.__name__ if hasattr(cls, '__name__') else 'unknown'})>"

class SafeInstance:
    """Proxy for objects returned by SafeClass to block introspection on instances.
    
    Blocks dangerous dunders (__init__, __class__, __globals__, __dict__, etc.)
    while delegating safe operational dunders and normal attribute access.
    """
    BLOCKED_ATTRS = {
        '__globals__', '__code__', '__builtins__', '__dict__',
        '__class__', '__bases__', '__subclasses__', '__init__',
        '__loader__', '__spec__', '__package__', '__func__',
        '__self__', '__closure__',
    }
    # Operational dunders that must be forwarded for objects like DataFrames
    SAFE_DUNDERS = {
        '__name__', '__doc__', '__str__', '__repr__', '__call__',
        '__len__', '__length_hint__',
        '__getitem__', '__setitem__', '__delitem__', '__contains__',
        '__iter__', '__next__', '__reversed__',
        '__bool__', '__hash__',
        '__add__', '__radd__', '__iadd__',
        '__sub__', '__rsub__', '__isub__',
        '__mul__', '__rmul__', '__imul__',
        '__truediv__', '__rtruediv__', '__itruediv__',
        '__floordiv__', '__rfloordiv__', '__ifloordiv__',
        '__mod__', '__rmod__', '__imod__',
        '__pow__', '__rpow__', '__ipow__',
        '__neg__', '__pos__', '__abs__', '__invert__',
        '__and__', '__rand__', '__iand__',
        '__or__', '__ror__', '__ior__',
        '__xor__', '__rxor__', '__ixor__',
        '__lt__', '__le__', '__eq__', '__ne__', '__gt__', '__ge__',
        '__int__', '__float__', '__complex__', '__index__',
        '__round__', '__trunc__', '__floor__', '__ceil__',
        '__enter__', '__exit__',
        '__format__',
    }
    
    def __init__(self, obj):
        object.__setattr__(self, '_obj', obj)
    
    def __getattribute__(self, name):
        if name == '_obj':
            return object.__getattribute__(self, name)
        
        if name in object.__getattribute__(self, 'BLOCKED_ATTRS'):
            raise AttributeError(f"access to '{name}' is restricted")
        
        if name.startswith('__') and name.endswith('__'):
            if name not in object.__getattribute__(self, 'SAFE_DUNDERS'):
                raise AttributeError(f"access to '{name}' is restricted")
        
        obj = object.__getattribute__(self, '_obj')
        attr = getattr(obj, name)
        
        # Wrap bound methods so their __globals__ can't be accessed
        if callable(attr) and isinstance(attr, types.MethodType):
            return SafeCallable(attr)
        
        return attr
    
    def __setattr__(self, name, value):
        if name == '_obj':
            object.__setattr__(self, name, value)
            return
        obj = object.__getattribute__(self, '_obj')
        setattr(obj, name, value)
    
    # Delegate core protocols directly to avoid infinite recursion
    def __len__(self):
        return len(object.__getattribute__(self, '_obj'))
    
    def __getitem__(self, key):
        return object.__getattribute__(self, '_obj')[key]
    
    def __setitem__(self, key, value):
        object.__getattribute__(self, '_obj')[key] = value
    
    def __contains__(self, item):
        return item in object.__getattribute__(self, '_obj')
    
    def __iter__(self):
        return iter(object.__getattribute__(self, '_obj'))
    
    def __bool__(self):
        return bool(object.__getattribute__(self, '_obj'))
    
    def __str__(self):
        return str(object.__getattribute__(self, '_obj'))
    
    def __repr__(self):
        return repr(object.__getattribute__(self, '_obj'))

results = []

# 4. EXECUTION LOOP
for item in batch_items:
    row_data = item.get("data")
    row_id = item.get("id")

    scope = {
        "__builtins__": {
            "abs": abs, "min": min, "max": max, "len": len, "sum": sum,
            "round": round, "int": int, "float": float, "str": str, "list": list,
            "dict": dict, "set": set, "tuple": tuple, "enumerate": enumerate,
            "range": range, "zip": zip, "isinstance": isinstance,
            "sorted": sorted, "reversed": reversed,
            "map": map, "filter": filter, "any": any, "all": all,
            "next": next, "iter": iter, "getattr": getattr,
            # Standard exceptions (needed for error handling)
            "Exception": Exception, "ValueError": ValueError, "TypeError": TypeError,
            "KeyError": KeyError, "IndexError": IndexError, "AttributeError": AttributeError,
            "ZeroDivisionError": ZeroDivisionError, "RuntimeError": RuntimeError,
            "StopIteration": StopIteration, "AssertionError": AssertionError,
            "NameError": NameError,
        },
        "json": row_data, 
        "output": {}, 
        "MathROUND": MathROUND,
        "MathMEAN": MathMEAN,
        "MathMAX": MathMAX, 
        "MathMIN": MathMIN,
        "GetProtocolByLabel": GetProtocolByLabel,
        "ArrayNth": ArrayNth,
        "TransformTrace": TransformTrace,
        "danger": danger,
        "np": SafeModule(np),
        "pd": SafeModule(pd),
        "scipy": SafeModule(scipy),
        "json_module": SafeModule(json)
    }
    
    try:
        # EXECUTE WITH TIMEOUT
        # Set a 1-second CPU/Wall clock alarm for this specific execution
        signal.signal(signal.SIGALRM, lambda signum, frame: (_ for _ in ()).throw(TimeoutError("Script execution timed out")))
        signal.alarm(1) # 1 second

        exec(compiled_code, scope)
        
        signal.alarm(0) # Disable alarm on success

        results.append({
            "id": row_id,
            "success": True,
            "output": scope.get("output", {})
        })
    except Exception as e:
        signal.alarm(0) # Ensure alarm is disabled

        err_msg = "".join(traceback.format_exception_only(type(e), e)).strip()
        results.append({
            "id": row_id,
            "success": False,
            "error": err_msg
        })

# 5. OUTPUT
print(json.dumps({"status": "success", "results": results}))
