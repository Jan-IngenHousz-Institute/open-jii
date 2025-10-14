"""
Python Helper Functions for OpenJII MultispeQ Data Processing

This module provides Python equivalents of the JavaScript helper functions
used in MultispeQ macro processing. These functions are made available to
Python macros during execution.

Key Features:
- Array manipulation functions (ArrayNth, ArrayRange, ArrayZip, etc.)
- Mathematical functions (statistics, regression, transformations)
- Protocol handling functions
- Messaging functions for macro output
- Advanced mathematical operations
"""

import math
import json
import statistics
from typing import List, Dict, Any, Union

# Try to import numpy and scipy, fall back to standard library if not available
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    print("[HELPERS] WARNING: NumPy not available. Some advanced functions may be limited.")

try:
    from scipy import stats
    from scipy.optimize import curve_fit
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print("[HELPERS] WARNING: SciPy not available. Some advanced functions may be limited.")

try:
    from scipy.signal import savgol_filter
    SCIPY_SIGNAL_AVAILABLE = True
except ImportError:
    SCIPY_SIGNAL_AVAILABLE = False


def ArrayNth(arr: List[Union[int, float]], size: int = 1, idx: int = 0) -> List[Union[int, float]]:
    """
    Extract every n-th element from an array.
    
    Args:
        arr: Input array
        size: Step size (default: 1)
        idx: Starting point (default: 0)
        
    Returns:
        Every n-th element
        
    Example:
        ArrayNth([1, 2, 3, 4, 5, 6], 2, 2)
        # returns [3, 5]
    """
    if not isinstance(arr, list):
        return None
    
    if idx < 0:
        idx = 0
    
    if size < 1:
        size = 1
    
    return arr[idx::size]


def ArrayRange(start: int = None, stop: int = None, step: int = 1, transform: str = "none") -> List[Union[int, float]]:
    """
    Generate an array of arithmetic progressions with optional transformations.
    
    Args:
        start: Start value (default: 0)
        stop: Stop value (required if start is provided)
        step: Step size (default: 1)
        transform: Transformation type ('none', 'log', 'ln', 'x2')
        
    Returns:
        Array of numbers with optional transformation applied
        
    Example:
        ArrayRange(10)  # returns [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        ArrayRange(1, 11)  # returns [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        ArrayRange(0, 10, 3, "x2")  # returns [0, 9, 36, 81]
    """
    if start is None:
        return []
    
    if not isinstance(start, (int, float)):
        return None
    
    if stop is None:
        stop = start
        start = 0
    
    if not isinstance(stop, (int, float)):
        return None
    
    if not isinstance(step, (int, float)) or step == 0:
        return None
    
    if transform not in ['none', 'log', 'ln', 'x2']:
        return None
    
    arr = []
    current = start
    
    while (step > 0 and current < stop) or (step < 0 and current > stop):
        if transform == 'none':
            arr.append(current)
        elif transform == 'log':
            arr.append(math.log10(current) if current > 0 else None)
        elif transform == 'ln':
            arr.append(math.log(current) if current > 0 else None)
        elif transform == 'x2':
            arr.append(current ** 2)
        current += step
    
    return [x for x in arr if x is not None]


def ArrayUnZip(input_data: List[List[Union[int, float]]]) -> Dict[str, List[Union[int, float]]]:
    """
    Transform an array of [x, y] pairs into an object with separate x and y arrays.
    
    Args:
        input_data: Array of [x, y] pairs
        
    Returns:
        Dictionary with 'x' and 'y' arrays
        
    Example:
        ArrayUnZip([[1, 4], [2, 5], [3, 6]])
        # returns {'x': [1, 2, 3], 'y': [4, 5, 6]}
    """
    if not input_data or not isinstance(input_data, list) or not isinstance(input_data[0], list):
        return None
    
    x_vals = []
    y_vals = []
    
    for pair in input_data:
        if len(pair) >= 2:
            x_vals.append(pair[0])
            y_vals.append(pair[1])
    
    return {'x': x_vals, 'y': y_vals}


def ArrayZip(x: List[Union[int, float]], y: List[Union[int, float]]) -> List[List[Union[int, float]]]:
    """
    Transform two arrays into one array of x,y pairs.
    
    Args:
        x: Array of x values
        y: Array of y values
        
    Returns:
        Array of [x, y] pairs
        
    Example:
        ArrayZip([1, 2, 3], [4, 5, 6])
        # returns [[1, 4], [2, 5], [3, 6]]
    """
    if not isinstance(x, list) or not isinstance(y, list) or len(x) != len(y):
        return None
    
    return [[x[i], y[i]] for i in range(len(x))]


def GetIndexByLabel(label: str, json_data: Dict, array: bool = False) -> Union[int, List[int]]:
    """
    Find positions for protocols within a protocol set matching the provided label.
    
    Args:
        label: Label from the protocol set
        json_data: The protocol content
        array: Always return an array (default: False)
        
    Returns:
        Single index or array of indexes
    """
    if label is None:
        return None
    
    if not json_data.get('set'):
        return None
    
    indexes = []
    for i, protocol in enumerate(json_data['set']):
        if protocol.get('label') == label:
            indexes.append(i)
    
    if len(indexes) == 0:
        return None
    elif len(indexes) == 1 and not array:
        return indexes[0]
    else:
        return indexes


def GetLabelLookup(json_data: Dict) -> Dict[str, List[int]]:
    """
    Generate a protocol lookup table for a protocol set.
    
    Args:
        json_data: Protocol data
        
    Returns:
        Lookup table mapping labels to index arrays
    """
    if not json_data.get('set'):
        return None
    
    lookup = {}
    for i, protocol in enumerate(json_data['set']):
        label = protocol.get('label')
        if label:
            if label not in lookup:
                lookup[label] = []
            lookup[label].append(i)
    
    return lookup if lookup else None


def GetProtocolByLabel(label: str, json_data: Dict, array: bool = False) -> Union[Dict, List[Dict]]:
    """
    Returns protocols from within the protocol set matching the provided label.
    
    Args:
        label: The label from the protocol set
        json_data: The protocol content
        array: Always return an array (default: False)
        
    Returns:
        Single protocol or array of protocols
    """
    if label is None:
        return None
    
    if not json_data.get('set'):
        return None
    
    protocols = [p for p in json_data['set'] if p.get('label') == label]
    
    if len(protocols) == 0:
        return None
    elif len(protocols) == 1 and not array:
        return protocols[0]
    else:
        return protocols


# Mathematical Functions

def MathLINREG(x: List[float], y: List[float]) -> Dict[str, float]:
    """
    Perform simple linear regression (y = mx + b).
    
    Args:
        x: x-values
        y: y-values
        
    Returns:
        Dictionary with slope (m), y-intercept (b), correlation coefficient (r), and R² (r2)
    """
    if len(x) != len(y) or len(x) < 2:
        return None
    
    try:
        if SCIPY_AVAILABLE:
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
            return {
                'm': slope,
                'b': intercept,
                'r': r_value,
                'r2': r_value ** 2
            }
        else:
            # Fallback calculation without scipy
            n = len(x)
            sum_x = sum(x)
            sum_y = sum(y)
            sum_xy = sum(x[i] * y[i] for i in range(n))
            sum_x2 = sum(xi ** 2 for xi in x)
            sum_y2 = sum(yi ** 2 for yi in y)
            
            # Calculate slope and intercept
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
            intercept = (sum_y - slope * sum_x) / n
            
            # Calculate correlation coefficient
            numerator = n * sum_xy - sum_x * sum_y
            denominator = math.sqrt((n * sum_x2 - sum_x ** 2) * (n * sum_y2 - sum_y ** 2))
            r_value = numerator / denominator if denominator != 0 else 0
            
            return {
                'm': slope,
                'b': intercept,
                'r': r_value,
                'r2': r_value ** 2
            }
    except:
        return None


def MathLN(value: Union[int, float]) -> float:
    """
    Returns the natural logarithm (base E) of a number.
    
    Args:
        value: Input value
        
    Returns:
        Natural logarithm of the value
    """
    if value and value > 0:
        return math.log(value)
    return None


def MathLOG(value: Union[int, float]) -> float:
    """
    Returns the logarithm (base 10) of a number.
    
    Args:
        value: Input value
        
    Returns:
        Base-10 logarithm of the value
    """
    if value and value > 0:
        return math.log10(value)
    return None


def MathMAX(values: List[Union[int, float]]) -> float:
    """
    Get the maximum value from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Maximum value
    """
    if values and isinstance(values, list) and len(values) > 0:
        try:
            return max(values)
        except:
            return None
    return None


def MathMEAN(values: List[Union[int, float]]) -> float:
    """
    Calculate the mean from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Mean value
    """
    if values and isinstance(values, list) and len(values) > 0:
        try:
            return statistics.mean(values)
        except:
            return None
    return None


def MathMEDIAN(values: List[Union[int, float]]) -> float:
    """
    Calculate the median from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Median value
    """
    if values and isinstance(values, list) and len(values) > 0:
        try:
            return statistics.median(values)
        except:
            return None
    return None


def MathMIN(values: List[Union[int, float]]) -> float:
    """
    Get the minimum value from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Minimum value
    """
    if values and isinstance(values, list) and len(values) > 0:
        try:
            return min(values)
        except:
            return None
    return None


def MathROUND(value: Union[int, float], digits: int = 2) -> float:
    """
    Round a number to specified decimal places.
    
    Args:
        value: Value to round
        digits: Number of decimal places (default: 2)
        
    Returns:
        Rounded value
    """
    if value is None or value == '':
        return None
    
    try:
        return round(float(value), digits)
    except:
        return None


def MathSTDERR(values: List[Union[int, float]]) -> float:
    """
    Calculate the standard error from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Standard error
    """
    if values and isinstance(values, list) and len(values) > 1:
        try:
            std_dev = statistics.stdev(values)
            return std_dev / math.sqrt(len(values))
        except:
            return None
    return None


def MathSTDEV(values: List[Union[int, float]]) -> float:
    """
    Calculate the population standard deviation from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Population standard deviation
    """
    if values and isinstance(values, list) and len(values) > 0:
        try:
            return statistics.pstdev(values)
        except:
            return None
    return None


def MathSTDEVS(values: List[Union[int, float]]) -> float:
    """
    Calculate the sample standard deviation from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Sample standard deviation
    """
    if values and isinstance(values, list) and len(values) > 1:
        try:
            return statistics.stdev(values)
        except:
            return None
    return None


def MathSUM(values: List[Union[int, float]]) -> float:
    """
    Calculate the sum from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Sum of values
    """
    if values and isinstance(values, list) and len(values) > 0:
        try:
            return sum(values)
        except:
            return None
    return None


def MathVARIANCE(values: List[Union[int, float]]) -> float:
    """
    Calculate the variance from an array of numbers.
    
    Args:
        values: Array of numbers
        
    Returns:
        Variance
    """
    if values and isinstance(values, list) and len(values) > 1:
        try:
            return statistics.variance(values)
        except:
            return None
    return None


# Messaging Functions

def info(msg: str, output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add an Info Message for the User.
    
    Args:
        msg: Info message
        output: Output object that is returned at the end
        
    Returns:
        Modified output object with the message
    """
    if 'messages' not in output:
        output['messages'] = {}
    if 'info' not in output['messages']:
        output['messages']['info'] = []
    output['messages']['info'].append(msg)
    return output


def warning(msg: str, output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add a Warning Message for the User.
    
    Args:
        msg: Warning message
        output: Output object that is returned at the end
        
    Returns:
        Modified output object with the message
    """
    if 'messages' not in output:
        output['messages'] = {}
    if 'warning' not in output['messages']:
        output['messages']['warning'] = []
    output['messages']['warning'].append(msg)
    return output


def danger(msg: str, output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add a Danger Message for the User.
    
    Args:
        msg: Danger message
        output: Output object that is returned at the end
        
    Returns:
        Modified output object with the message
    """
    if 'messages' not in output:
        output['messages'] = {}
    if 'danger' not in output['messages']:
        output['messages']['danger'] = []
    output['messages']['danger'].append(msg)
    return output


# Advanced Mathematical Functions

def MathMULTREG(input_raw: List[List[float]]) -> Dict[str, Any]:
    """
    Multiple Linear Regression.
    
    Args:
        input_raw: Array with values [predictor 1, predictor 2, ..., response]
        
    Returns:
        Regression results
    """
    if not input_raw or len(input_raw) < 2:
        return None
    
    if not NUMPY_AVAILABLE:
        print("[HELPERS] WARNING: NumPy required for MathMULTREG")
        return None
    
    try:
        # Convert to numpy arrays
        data = np.array(input_raw)
        X = data[:, :-1]  # All columns except last (predictors)
        y = data[:, -1]   # Last column (response)
        
        # Add intercept column
        X = np.column_stack([np.ones(len(X)), X])
        
        # Calculate coefficients using normal equation
        coefficients = np.linalg.lstsq(X, y, rcond=None)[0]
        
        # Calculate R-squared
        y_pred = X.dot(coefficients)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        return {
            'coefficients': coefficients.tolist(),
            'r_squared': r_squared,
            'intercept': coefficients[0],
            'slopes': coefficients[1:].tolist()
        }
    except:
        return None


def MathEXPINVREG(input_raw: List[List[float]]) -> Dict[str, Any]:
    """
    Exponential inverse regression: Fit to Y = Y0 + Ae^(-x/t).
    
    Args:
        input_raw: Array of [predictor, response] pairs
        
    Returns:
        Regression results
    """
    if not input_raw or len(input_raw) < 3:
        return None
    
    if not NUMPY_AVAILABLE or not SCIPY_AVAILABLE:
        print("[HELPERS] WARNING: NumPy and SciPy required for MathEXPINVREG")
        return None
    
    try:
        data = np.array(input_raw)
        x = data[:, 0]
        y = data[:, 1]
        
        # Define the exponential decay function
        def exp_decay(x, y0, a, t):
            return y0 + a * np.exp(-x / t)
        
        # Initial parameter guesses
        y0_guess = min(y)
        a_guess = max(y) - min(y)
        t_guess = (max(x) - min(x)) / 3
        
        # Fit the curve
        popt, pcov = curve_fit(exp_decay, x, y, p0=[y0_guess, a_guess, t_guess])
        
        # Calculate R-squared
        y_pred = exp_decay(x, *popt)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        return {
            'y0': popt[0],
            'a': popt[1],
            't': popt[2],
            'r_squared': r_squared,
            'parameters': popt.tolist()
        }
    except:
        return None


def MathPOLYREG(input_raw: List[List[float]], degree: int) -> Dict[str, Any]:
    """
    Polynomial regression: fit to y = a0 + a1*x + a2*x^2 + a3*x^3 + ...
    
    Args:
        input_raw: Array of [predictor, response] pairs
        degree: Degree of polynomial
        
    Returns:
        Regression results
    """
    if not input_raw or len(input_raw) < degree + 1:
        return None
    
    if not NUMPY_AVAILABLE:
        print("[HELPERS] WARNING: NumPy required for MathPOLYREG")
        return None
    
    try:
        data = np.array(input_raw)
        x = data[:, 0]
        y = data[:, 1]
        
        # Fit polynomial
        coefficients = np.polyfit(x, y, degree)
        
        # Calculate R-squared
        y_pred = np.polyval(coefficients, x)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        return {
            'coefficients': coefficients.tolist(),
            'r_squared': r_squared,
            'degree': degree
        }
    except:
        return None


def TransformTrace(fn: str, a1: List[float], a2: Union[float, List[float]] = None) -> List[float]:
    """
    Transform a given array by providing a second array or a single number.
    
    Args:
        fn: Function name ('add', 'subtract', 'multiply', 'divide', '+', '-', '*', '/', 
            'normToMin', 'normToMax', 'normToRange', 'normToIdx', 'normToVal', 'ma', 'sgf', 'abs')
        a1: Input array
        a2: Second array or single number (optional)
        
    Returns:
        Transformed array
    """
    if not isinstance(a1, list) or len(a1) == 0:
        return None
    
    try:
        if NUMPY_AVAILABLE:
            arr = np.array(a1)
        else:
            arr = a1[:]  # Make a copy
    
        if fn in ['add', '+']:
            if isinstance(a2, (int, float)):
                if NUMPY_AVAILABLE:
                    return (arr + a2).tolist()
                else:
                    return [x + a2 for x in arr]
            elif isinstance(a2, list) and len(a2) == len(a1):
                if NUMPY_AVAILABLE:
                    return (arr + np.array(a2)).tolist()
                else:
                    return [a1[i] + a2[i] for i in range(len(a1))]
                
        elif fn in ['subtract', '-']:
            if isinstance(a2, (int, float)):
                if NUMPY_AVAILABLE:
                    return (arr - a2).tolist()
                else:
                    return [x - a2 for x in arr]
            elif isinstance(a2, list) and len(a2) == len(a1):
                if NUMPY_AVAILABLE:
                    return (arr - np.array(a2)).tolist()
                else:
                    return [a1[i] - a2[i] for i in range(len(a1))]
                
        elif fn in ['multiply', '*']:
            if isinstance(a2, (int, float)):
                if NUMPY_AVAILABLE:
                    return (arr * a2).tolist()
                else:
                    return [x * a2 for x in arr]
            elif isinstance(a2, list) and len(a2) == len(a1):
                if NUMPY_AVAILABLE:
                    return (arr * np.array(a2)).tolist()
                else:
                    return [a1[i] * a2[i] for i in range(len(a1))]
                
        elif fn in ['divide', '/']:
            if isinstance(a2, (int, float)) and a2 != 0:
                if NUMPY_AVAILABLE:
                    return (arr / a2).tolist()
                else:
                    return [x / a2 for x in arr]
            elif isinstance(a2, list) and len(a2) == len(a1):
                if NUMPY_AVAILABLE:
                    a2_arr = np.array(a2)
                    return np.divide(arr, a2_arr, out=np.zeros_like(arr), where=a2_arr!=0).tolist()
                else:
                    return [a1[i] / a2[i] if a2[i] != 0 else 0 for i in range(len(a1))]
                
        elif fn == 'normToMin':
            if NUMPY_AVAILABLE:
                min_val = np.min(arr)
                return (arr / min_val if min_val != 0 else arr).tolist()
            else:
                min_val = min(arr)
                return [x / min_val if min_val != 0 else x for x in arr]
            
        elif fn == 'normToMax':
            if NUMPY_AVAILABLE:
                max_val = np.max(arr)
                return (arr / max_val if max_val != 0 else arr).tolist()
            else:
                max_val = max(arr)
                return [x / max_val if max_val != 0 else x for x in arr]
            
        elif fn == 'normToRange':
            if NUMPY_AVAILABLE:
                min_val, max_val = np.min(arr), np.max(arr)
                range_val = max_val - min_val
                return ((arr - min_val) / range_val if range_val != 0 else np.zeros_like(arr)).tolist()
            else:
                min_val, max_val = min(arr), max(arr)
                range_val = max_val - min_val
                return [(x - min_val) / range_val if range_val != 0 else 0 for x in arr]
            
        elif fn == 'normToIdx' and isinstance(a2, int) and 0 <= a2 < len(a1):
            norm_val = arr[a2] if NUMPY_AVAILABLE else a1[a2]
            if NUMPY_AVAILABLE:
                return (arr / norm_val if norm_val != 0 else arr).tolist()
            else:
                return [x / norm_val if norm_val != 0 else x for x in arr]
            
        elif fn == 'normToVal' and isinstance(a2, (int, float)):
            if NUMPY_AVAILABLE:
                return (arr / a2 if a2 != 0 else arr).tolist()
            else:
                return [x / a2 if a2 != 0 else x for x in arr]
            
        elif fn == 'ma':  # Moving average
            window = min(3, len(arr))
            if NUMPY_AVAILABLE:
                return np.convolve(arr, np.ones(window)/window, mode='same').tolist()
            else:
                # Simple moving average implementation
                result = []
                for i in range(len(arr)):
                    start = max(0, i - window//2)
                    end = min(len(arr), i + window//2 + 1)
                    result.append(sum(arr[start:end]) / (end - start))
                return result
                
        elif fn == 'sgf':  # Savitzky-Golay filter
            if SCIPY_SIGNAL_AVAILABLE and NUMPY_AVAILABLE:
                window_length = min(5, len(arr) if len(arr) % 2 == 1 else len(arr) - 1)
                if window_length >= 3:
                    return savgol_filter(arr, window_length, 2).tolist()
            # Fallback to moving average if scipy not available
            return TransformTrace('ma', a1, a2)
                
        elif fn == 'abs':  # Absorbance: -log(I/I0)
            i0 = a2 if isinstance(a2, (int, float)) else arr[0]
            if i0 > 0:
                if NUMPY_AVAILABLE:
                    return (-np.log10(arr / i0)).tolist()
                else:
                    return [-math.log10(x / i0) if x > 0 else 0 for x in arr]
                
    except Exception as e:
        print(f"Error in TransformTrace: {e}")
        return None
    
    return None


def calcSunAngle(roll: float, pitch: float, compass: float, azimuth: float, altitude: float) -> float:
    """
    Calculate the angular difference between the device and the sun.
    
    Args:
        roll: Device roll angle
        pitch: Device pitch angle
        compass: Device compass heading
        azimuth: Sun azimuth angle
        altitude: Sun altitude angle
        
    Returns:
        Angular difference in degrees
    """
    try:
        # Convert to radians
        roll_rad = math.radians(roll)
        pitch_rad = math.radians(pitch)
        compass_rad = math.radians(compass)
        azimuth_rad = math.radians(azimuth)
        altitude_rad = math.radians(altitude)
        
        # Device normal vector
        device_x = math.sin(roll_rad) * math.cos(pitch_rad)
        device_y = -math.sin(pitch_rad)
        device_z = math.cos(roll_rad) * math.cos(pitch_rad)
        
        # Sun vector
        sun_x = math.cos(altitude_rad) * math.sin(azimuth_rad - compass_rad)
        sun_y = math.sin(altitude_rad)
        sun_z = math.cos(altitude_rad) * math.cos(azimuth_rad - compass_rad)
        
        # Dot product
        dot_product = device_x * sun_x + device_y * sun_y + device_z * sun_z
        
        # Angle in degrees
        angle = math.degrees(math.acos(max(-1, min(1, dot_product))))
        
        return angle
    except:
        return None


# Make all functions available for import
__all__ = [
    'ArrayNth', 'ArrayRange', 'ArrayUnZip', 'ArrayZip',
    'GetIndexByLabel', 'GetLabelLookup', 'GetProtocolByLabel',
    'MathLINREG', 'MathLN', 'MathLOG', 'MathMAX', 'MathMEAN', 'MathMEDIAN',
    'MathMIN', 'MathROUND', 'MathSTDERR', 'MathSTDEV', 'MathSTDEVS',
    'MathSUM', 'MathVARIANCE', 'info', 'warning', 'danger',
    'MathMULTREG', 'MathEXPINVREG', 'MathPOLYREG', 'TransformTrace', 'calcSunAngle'
]