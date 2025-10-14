/**
 * Extract every n-th element from an array.
 * @access public
 * @param {number[]} arr Input array.
 * @param {number} [size=1] Step size.
 * @param {number} [idx=0] Starting point.
 * @returns {number[]|void} Every n-th element.
 * @example ArrayNth( [ 1, 2, 3, 4, 5, 6], 2, 2 );
 * // returns [3, 5]
 */

function ArrayNth(arr, size, idx) {

    if (!Array.isArray(arr))
        return null;

    if (idx === undefined || idx < 0)
        idx = 0;

    if (size === undefined || size < 1)
        size = 1;

    var sliced = [];
    for (i = idx; i < arr.length; i = i + size) {
        sliced.push(arr[i]);
    }
    return sliced;
}
/**
 * This is a flexible function to generate an array of arithmetic progressions.
 * All arguments must be integers.
 * @access public
 * @param {number} [start=0] Start value.
 * @param {number} stop Stop value.
 * @param {number} [step=1] Step size.
 * @param {('none'|'log'|'ln'|'x2')} [transform="none"] Generate a progression and transform numbers.
 * @returns {number[]|void}
 * @example ArrayRange(10);
 * // returns [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 *
 * ArrayRange(1,11);
 * // returns [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 *
 * ArrayRange(0, 30, 5);
 * // returns [0, 5, 10, 15, 20, 25]
 *
 * ArrayRange(0, 10, 3);
 * // returns [0, 3, 6, 9]
 *
 * ArrayRange(0, 10, 3, "x2");
 * // returns [0, 9, 36, 81]
 *
 * ArrayRange(0, -10, -1);
 * // returns [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
 *
 * ArrayRange(0);
 * // returns []
 *
 * ArrayRange(1,0);
 * // returns []
 */

function ArrayRange(start, stop, step, transform) {

    if(start === undefined || typeof start != 'number')
        return null;

    if(stop === undefined){
        stop = start;
        start = 0;
    }
    if(typeof stop != 'number')
        return null;

    if(step === undefined || step === null)
        step = 1;

    if(typeof step != 'number' || step == 0)
        return null;

    if(transform === undefined)
        transform = 'none';

    if(['none','log','ln','x2'].indexOf(transform) == -1)
        return null;

    var arr = [];

    while (step > 0 ? stop > start : stop < start) {
        if(transform == 'none')
            arr.push(start);
        if(transform == 'log')
            arr.push( Math.log(start) / Math.LN10);
        if(transform == 'ln')
            arr.push( Math.log(start) );
        if(transform == 'x2')
            arr.push( Math.pow(start, 2) );
        start += step;
    }
    return arr;
}
/**
 * This function transforms an array of [x, y] pairs into an object with an array of x and an array of y values
 * @access public
 * @param {array[]} input Array of [x, y] pairs.
 * @returns {object|void} { x: [x1, x2, ..., xn], y: [y1, y2, ..., yn] }
 * @example ArrayUnZip( [ [1, 4], [2, 5], [3, 6] ] );
 * //returns {x: [1, 2, 3], y: [4, 5, 6]}
 */

function ArrayUnZip(input){
    // check both inputs
    if(input === undefined || input.length == 0 || !Array.isArray(input) || !Array.isArray(input[0]))
        return null;

    var arrays = {x: [], y: []};
    for(var i=0,len=input.length; i<len; i++){
        arrays.x.push(input[i][0] || null);
        arrays.y.push(input[i][1] || null);
    }
    return arrays;
}
/**
 * This function transforms two arrays into one array of x,y pairs
 * Both arrays supplied need to have the same size.
 * @access public
 * @param {number[]} x values.
 * @param {number[]} y values.
 * @returns {number[]|void} [ [x1,y1], [x2,y2], ..., [xn,yn] ].
 * @example var x = [1, 2, 3];
 * var y = [4, 5, 6];
 * ArrayZip(x,y)
 * //returns [ [1, 4], [2, 5], [3, 6] ]
 */

function ArrayZip(x,y){
    // check both inputs
    if(x === undefined || y === undefined || !Array.isArray(x) || !Array.isArray(y) || x.length != y.length)
        return null;

    var arr = [];
    for(var i=0,len=x.length; i<len; i++){
        arr.push([x[i],y[i]]);
    }
    return arr;
}
/**
 * Find the positions for protocols within a protocol set matching the
 * provided label. If only one label exists within a set, a number is returned.
 * When multiple protocols in the set have the same label an array with all
 * indexes of matching labels is returned.
 * @access public
 * @param {string} label Label from the protocol set
 * @param {Object} json Required! The protocol content
 * @param {boolean} [array=false] Always return an array
 * @returns {(number|number[])} Single index or an array of indexes
 * @example GetIndexByLabel( "PAM", json );
 * // returns e.g. 1 or [1,2]
 *
 * GetIndexByLabel( "PAM", json, true );
 * // returns e.g. [1] or [1,2]
 */

function GetIndexByLabel( label, json, array ) {
    if(label === undefined)
        return null;

    if(array === undefined)
        array = false;

    var out = json.set.map(function(a,i){
        if(a.label == label)
            return i;
        else
            return null;
    }).filter(Number);

    if( out.length == 0 )
        return null;
    if( out.length == 1 )
        return array ? out : out[0];
    else
        return out;
}
/**
 * Generate a protocol lookup table for a protocol set.
 * @access public
 * @param {object} json
 * @returns {object} Lookup table
 * @example GetLabelLookup(json);
 * // returns e.g. { "PAM": [0,2], "ECS": [1]}
 */

function GetLabelLookup(json){
    var lookup = {};
    // Return null if there is no set
	if(json.set === undefined)
		return null;
    for(var i in json.set){
        if(json.set[i].label !== undefined){
            if(lookup[json.set[i].label] === undefined)
                lookup[json.set[i].label] = [];
            lookup[json.set[i].label].push(i);
        }
        else{
            if(lookup.unknown === undefined)
                lookup.unknown = [];
            lookup.unknown.push(i);
        }
    }
    if(Object.keys(lookup).length == 0)
        return null;
    else
        return lookup;
}
/**
 * Returns the protocol from within the protocol set matching the provided label.
 * If only one label exists, one protocol object is returned.
 * When multiple protocols in the set have the same label an array with all
 * protcol objects of matching labels is returned.
 * @access public
 * @param {string} label The label from the protocol set
 * @param {Object} json Required! The protocol content
 * @param {boolean} [array=false] Always return an array
 * @returns {(Object|Object[])} Single protocol or an array of protocols
 * @example GetIndexByLabel( "PAM", json );
 * // returns e.g. { "label": "PAM", ...} or [{ "label": "PAM", ...}, { "label": "PAM", ...}]
 *
 * GetIndexByLabel( "PAM", json, true );
 * // returns e.g. [{ "label": "PAM", ...}] or [{ "label": "PAM", ...}, { "label": "PAM", ...}]
 */

function GetProtocolByLabel( label, json, array ) {
    if(label === undefined)
        return null;

    if(array === undefined)
        array = false;

    var out = json.set.filter(function(a){
        return a.label == label;
    });

    if( out.length == 0 )
        return null;
    if( out.length == 1 )
        return array ? out : out[0];
    else
        return out;
}
/**
 * Function to perform a simple linear regression (y = mx +b), returning slope, y-intercent, 
 * correlation coefficient (R) and coefficient of determination (R²).
 * @access public
 * @param {number[]} x x-values
 * @param {number[]} y y-values
 * @returns {object} Linear regression results
 * @example MathLINREG([60,61,62,63,65], [3.1,3.6,3.8,4,4.1]);
 * // returns {
 * // 	"m": 0.188,    // slope
 * // 	"b": -7.964,   // y intercept
 * // 	"r": 0.912,    // correlation coefficient
 * // 	"r2": 0.832    // coefficient of determination
 * }
 */

function MathLINREG(x, y) {
	var regression = false;

	// calculate number of points
	var xn = x.length;
	var yn = y.length;

	if (xn == yn) {
		// Calculate Sums
		var xSum = MathSUM(x);
		var ySum = MathSUM(y);

		var xxSum = 0;
		var xySum = 0;
		var yySum = 0;

		for (var i = 0; i < xn; i++) {
			xySum += (x[i] * y[i]);
			xxSum += (x[i] * x[i]);
			yySum += (y[i] * y[i]);
		}

		// calculate slope
		var m = ((xn * xySum) - (xSum * ySum)) / ((xn * xxSum) - (xSum * xSum));

		// calculate intercept
		var b = (ySum - (m * xSum)) / xn;

		// calculate r
		var r = (xySum - ((1 / xn) * xSum * ySum)) / Math.sqrt(((xxSum) - ((1 / xn) * (Math.pow(xSum, 2)))) * ((yySum) - ((1 / xn) * (Math.pow(ySum, 2)))));

		regression = {
			'm': m,
			'b': b,
			'r': r,
			'r2': (r * r)
		};
	}
	return regression;
}
/**
 * Returns the natural logarithm (base E) of a number.
 * @access public
 * @param {number} value
 * @returns {number}
 * @example MathLN(10);
 * // returns 2.302585092994046
 */

function MathLN(value) {
	var val = false;
	if (value) {
		val = Math.log(value);
	}
	return parseFloat(val);
}
/**
 * Returns the logarithm (base 10) of a number.
 * @access public
 * @param {number} value
 * @returns {number}
 * @example MathLOG(10);
 * // returns 1
 */

function MathLOG(value) {
	var val = false;
	if (value) {
		val = Math.log(value) / Math.LN10;
	}
	return parseFloat(val);
}
/**
 * Get the maximum value from an array of numbers. The function fails,
 * if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathMAX([1,2,3,4.5]);
 * // returns 4.5
 */

function MathMAX(values) {
	var max = false;
	if (values && Array.isArray(values)) {
		for (i = 0; i < values.length; i++) {
			if(!Number(values[i]) && values[i] !== null && values[i] != 0)
				return parseFloat(Number(values[i]));
			if (!max)
				max = Number(values[i]);
			else if (Number(values[i]) > max)
				max = Number(values[i]);
		}
	}
	return parseFloat(max);
}
/**
 * Calculate the variance from an array of numbers. The function fails,
 * if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathMEAN([1,2,3,4.5]);
 * // returns 2.625
 */

function MathMEAN(values) {
	var mean = false;
	var count = 0;
	if (values && Array.isArray(values)) {
		for (var i = 0, len = values.length; i < len; i++){
			if(values[i] === null)
				continue;
			else if(!Number(values[i]) && values[i] !== null && values[i] != 0)
				return parseFloat(!Number(values[i]));
			else{
				mean += Number(values[i]);
				count++;
			}
		}
		mean /= count;
	}
	return parseFloat(mean);
}
/**
 * Calculate the median from an array of numbers. The function fails,
 * if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathMEDIAN([1,2,3,4.5]);
 * // returns 2.5
 */

function MathMEDIAN(values) {
	var val = false;
	if (values && Array.isArray(values)) {

		var check = values.some(function(el){
			return (!Number(el) && el !== null && el != 0)? true : false;
		});

		if(check)
			return parseFloat(val);

		values = values.filter(function(itm){
			return (itm === null || (!Number(itm) && itm != 0)) ? false : true;
		});

		// Sort values
		values.sort(function (a, b) {
			if (a < b) //sort string ascending
				return -1;
			if (a > b) return 1;
			return 0; //default return value (no sorting)
		});

		var n = values.length;
		// Even
		if ((n % 2 == 0)) {
			val = (Number(values[(n / 2) - 1]) + Number(values[(n / 2)])) / 2;
		}
		// Odd
		if ((Math.abs(n) % 2 == 1)) {
			val = values[Math.floor((n / 2))];
		}
	}
	return parseFloat(val);
}
/**
 * Get the minimum value from an array of numbers. The function fails,
 * if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathMIN([1,2,3,4.5]);
 * // returns 1
 */

function MathMIN(values) {
	var min = false;
	if (values && Array.isArray(values)) {
		for (i = 0; i < values.length; i++) {
			if(!Number(values[i]) && values[i] !== null && values[i] != 0)
				return parseFloat(Number(values[i]));
			if (!min)
				min = Number(values[i]);
			else if (Number(values[i]) < min)
				min = Number(values[i]);
		}
	}
	return parseFloat(min);
}
/**
 * Calculate the variance from an array of numbers. The function fails, if the array is empty or has invalid values.
 * @access public
 * @param {number} value
 * @param {number} [digets=2] number of digits
 * @returns {number}
 * @example MathROUND(1.23456789, 5);
 * // returns 1.2346
 */

function MathROUND(value, digets) {
	digets = typeof digets !== 'undefined' ? digets : 2;
	var val = false;

	if (value === null || typeof value == 'object' || value == '') {
		return parseFloat(val);
	}

	if (Number(value) == 0) {
		return 0;
	}

	if (value && parseInt(digets) >= 0) {
		val = Math.round(Number(value) * Math.pow(10, digets)) / Math.pow(10, digets);
	}
	return parseFloat(val);
}
/**
 * Calculate the standard error from an array of numbers. The function fails, if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathSTDERR([1,2,3,4.5]);
 * // returns 0.6465050270492876
 */

function MathSTDERR(values) {
	var stderr = false;
	if (values && Array.isArray(values)) {

		var check = values.some(function(el){
			return (!Number(el) && el !== null && el != 0)? true : false;
		});

		if(check)
			return parseFloat(stderr);

		if (values.length > 2) {
			var mean = false;
			var count = 0;
			for (var i = 0, len = values.length; i < len; i++){
				if(values[i] === null)
					continue;
				else if(!Number(values[i]) && values[i] !== null && values[i] != 0)
					return parseFloat(!Number(values[i]));
				else{
					mean += Number(values[i]);
					count++;
				}
			}
			mean /= count;

			var tmp = [];
			var sum = false;
			for (i = 0, len = values.length; i < len; i++){
				if(values[i] === null)
					continue;
				var val = Math.pow((values[i] - mean), 2);
				sum += val;
				tmp.push(val);
			}
			stdev = Math.sqrt(sum / count);

			stderr = stdev / Math.sqrt(count);
		}
	}
	return parseFloat(stderr);
}
/**
 * Calculate the variance from an array of numbers. The function fails, if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathSTDEV([1,2,3,4.5]);
 * // returns 1.2930100540985752
 */

function MathSTDEV(values) {
	var stdev = false;
	if (values && Array.isArray(values)) {

		var check = values.some(function(el){
			return (!Number(el) && el !== null && el != 0)? true : false;
		});

		if(check)
			return parseFloat(stdev);

		values = values.filter(function(itm){
			return (itm === null || (!Number(itm) &&  itm != 0)) ? false : true;
		});

		if (values.length > 2) {
			var mean = false;
			var count = 0;
			for (var i = 0, len = values.length; i < len; i++){
				if(values[i] === null)
					continue;
				else if(!Number(values[i]) && values[i] !== null && values[i] != 0)
					return parseFloat(!Number(values[i]));
				else{
					mean += Number(values[i]);
					count++;
				}
			}
			mean /= count;

			var tmp = [];
			var sum = false;
			for (i = 0, len = values.length; i < len; i++){
				var val = Math.pow((values[i] - mean), 2);
				sum += val;
				tmp.push(val);
			}
			stdev = Math.sqrt(sum / values.length);
		}
	}
	return parseFloat(stdev);
}
/**
 * Calculate the variance from an array of numbers. The function fails, if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathSTDEVS([1,2,3,4.5]);
 * // returns 1.4930394055974097
 */

function MathSTDEVS(values) {
	var stdevs = false;
	if (values && Array.isArray(values)) {

		var check = values.some(function(el){
			return (!Number(el) && el !== null && el != 0)? true : false;
		});

		if(check)
			return parseFloat(stdevs);

		values = values.filter(function(itm){
			return (itm === null || (!Number(itm) &&  itm != 0)) ? false : true;
		});

		if (values.length > 2) {
			var mean = false;
			var count = 0;
			for (var i = 0, len = values.length; i < len; i++){
				if(values[i] === null)
					continue;
				else if(!Number(values[i]) && values[i] !== null && values[i] != 0)
					return parseFloat(!Number(values[i]));
				else{
					mean += Number(values[i]);
					count++;
				}
			}
			mean /= count;

			var tmp = [];
			var sum = false;
			for (var i = 0, len = values.length; i < len; i++){
				var val = Math.pow((values[i] - mean), 2);
				sum += val;
				tmp.push(val);
			}
			stdevs = Math.sqrt(sum / (values.length - 1));
		}
	}
	return parseFloat(stdevs);
}
/**
 * Calculate the sum from an array of numbers. The function fails, if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathSum([1,2,3,4.5]);
 * // returns 10.5
 */

function MathSUM(values) {
	var sum = false;
	if (values && Array.isArray(values)) {
		for (var i = 0, len = values.length; i < len; i++){
            if(values[i] === null)
                continue;
            if(!Number(values[i]) && values[i] != 0 ){
                sum = false;
                break;
            }
            sum += Number(values[i]);
        }
	}
	return parseFloat(sum);
}
/**
 * Calculate the variance from an array of numbers. The function fails, if the array is empty or has invalid values.
 * @access public
 * @param {number[]} values numbers
 * @returns {number}
 * @example MathVARIANCE([1,2,3,4.5]);
 * // returns 2.2292
 */

function MathVARIANCE(values) {
	var variance = false;
	var mean = false;
	var count = 0;
	if (values && Array.isArray(values)) {

		var check = values.some(function(el){
			return (!Number(el) && el !== null && el != 0)? true : false;
		});

		if(check || values.length == 0)
			return parseFloat(variance);

		values = values.filter(function(itm){
			return (itm === null || (!Number(itm) && itm != 0) ) ? false : true;
		});

		for (var i = 0, len = values.length; i < len; i++){
			if(values[i] === null)
				continue;
			else if(!Number(values[i]) && values[i] !== null && values[i] != 0)
				return parseFloat(!Number(values[i]));
			else{
				mean += Number(values[i]);
				count++;
			}
		}
		mean /= count;

		for (i = 0; i < values.length; i++) {
			variance += Math.pow((values[i] - mean), 2);
		}
		variance = (1 / (values.length - 1)) * variance;
	}
	return parseFloat(variance);
}
/**
 * Add an Info Message for the User.
 * Use these messages to give additional information (if necessary).
 * @access public
 * @param {string} msg Info Message
 * @param {object} output object that is returned at the end
 * @returns {object} pushes the message into the output object
 * @example info('Your Info Message', output);
 * // output['messages']['info']['Your Info Message']
 */

function info(msg, output) {
	if (output.messages === undefined)
		output.messages = {};
	if (output.messages.info === undefined)
		output.messages.info = [];
	output.messages.info.push(msg);
}

/**
 * Add an Warning Message for the User.
 * Use these messages to indicate a potential issue and direct the user to check the measurement again.
 * @access public
 * @param {string} msg Warning Message
 * @param {object} output object that is returned at the end
 * @returns {object} pushes the message into the output object
 * @example warning('Your Warning Message', output);
 * // output['messages']['warning']['Your Warning Message']
 */

function warning(msg, output) {
	if (output.messages === undefined)
		output.messages = {};
	if (output.messages.warning === undefined)
		output.messages.warning = [];
	output.messages.warning.push(msg);
}

/**
 * Add an Danger Message for the User. These messages will be shown in the data viewer as well.
 * Use these messages to indicate a problematic issue that will most likely result in an invalid measurement.
 * @access public
 * @param {string} msg Danger Message
 * @param {object} output object that is returned at the end
 * @returns {object} pushes the message into the output object
 * @example danger('Your Danger Message', output);
 * // output['messages']['info']['Your Danger Message']
 */

function danger(msg, output) {
	if (output.messages === undefined)
		output.messages = {};
	if (output.messages.danger === undefined)
		output.messages.danger = [];
	output.messages.danger.push(msg);
}
/**
 * Function to perform a non-linear regression.
 * @see http://statpages.info/nonlin.html
 * @access public
 * @param {object} data Data for the non-linear regression needs to be provided as an array of x,y pairs. `[[x1,y1], [x2,y2], ..., [xn,yn]]`
 * @param {object} options
 * @param {string} options.equation Formula for the function to be fitted
 * @param {number[]} options.initial Array with the initial guesses for parameters in equation
 * @param {number} [options.iterations=200] Number of iterations (maximum 2000)
 * @param {number} [options.cPts] Number of datapoints
 * @param {number} options.cVar Number of independant variables
 * @param {number} options.cPar Number of parameters
 * @param {number} [options.RelaxF=1.0] Fractional adjustment factor (Values smaller than 1 will make the covergence slower but more stable)
 * @param {(1|"Y"|"Sqrt(Y)"|"w"|"Rep")} [options.SEy=1] Standard Error associated with the Y variable (Equal `1`, Relative `Y`, Counts `Sqrt(Y)`, Data `w`, Replicates `Rep`
 * @param {("Y"|"LN(Y)"|"SQRT(Y)"|"1/Y")} [options.yTrans="Y"] Transformation
 * @param {("X1"|"LN(X1)"|"SQRT(X1)"|"1/X1")} [options.x1Trans="X1"] Transformation
 * @param {("X2"|"LN(X2)"|"SQRT(X2)"|"1/X2")} [options.x2Trans="X2"] Transformation
 * @param {("X3"|"LN(X3)"|"SQRT(X3)"|"1/X3")} [options.x3Trans="X3"] Transformation
 * @param {("X4"|"LN(X4)"|"SQRT(X4)"|"1/X4")} [options.x4Trans="X4"] Transformation
 * @param {("X5"|"LN(X5)"|"SQRT(X5)"|"1/X5")} [options.x5Trans="X5"] Transformation
 * @param {("X6"|"LN(X6)"|"SQRT(X6)"|"1/X6")} [options.x6Trans="X6"] Transformation
 * @param {("X7"|"LN(X7)"|"SQRT(X7)"|"1/X7")} [options.x7Trans="X7"] Transformation
 * @param {("X8"|"LN(X8)"|"SQRT(X8)"|"1/X8")} [options.x8Trans="X8"] Transformation
 * @param {boolean} [options.Centered=false] Centered Approximation to Partial Derivatives
 * @param {boolean} [options.LeastAbs=false] Least-Absolute -Value curve fitting
 * @param {number} [options.cPctile=50] Percentile
 * @returns {object}
 * @example NonLinearRegression(
 *  [
 *    [x1,y1],
 *    [x2,y2],
 *    ...,
 *    [xn,yn]
 *  ],
 *  {
 * 	  equation: "",
 * 	  initial: [a, b, ..., h]
 *  }
 * )
 *
 *
 * // Available equations
 * // "b + a * e(- x / c)"
 * // "( a - c ) * e( - b * t ) + c"
 * // "( c + a / ( 1 + b / x ) )"
 * // "( c + a * a / ( 1 + b / x ) )"
 *
 *
 * // returns
 * // {
 * //   text: <string>,
 * //   ParameterEstimates: <string>,
 * //   CovarianceMatrix: <string>,
 * //   r2: <number>
 * //   parameters: {
 * //     name: <string>,
 * //     value: <number>,
 * //     sd_error: <number>,
 * //     p: <number>
 * //   },
 * //   RMS_error: <number>,
 * //   presets: <object>,
 * //   iterations: <number>,
 * //   RMS_errors: <array>
 * // }
 */

function NonLinearRegression(data, options) {
	// Equal: all points are equally precise;
	// Relative: Std Err of each Y value is proportional to Y variable itself;
	// Counts: Std Err = square root of Y; this is appropriate if Y represents the # of occurrences of something (such as radioactive decay events);
	// Data: Std Err is specified in the data window as a separate column of numbers, immediately to the right of the Y values;
	// Replicates: Specify this if you have entered several Y values.

	// initial settings
	var presets = {
		iterations: (options.iterations === undefined || options.iterations > 2000) ? 200 : options.iterations,
		cPts: data.length || 0, // Number of datapoints
		cVar: options.variables || 1, // Number of independant variables
		cPar: options.initial.length || 0, // Number of parameters
		equation: options.equation || '', // Function
		RelaxF: options.RelaxF || 1.0, // 0.5, 0.2, 0.1, 0.05
		SEy: options.SEy || 1, //[1, 'Y','Sqrt(Y)','w','Rep'],
		yTrans: 'Y', //['Y', 'LN(Y)','LN(Y)', 'SQRT(Y)', '1/Y'],
		x1Trans: 'X', //['X', 'LN(X)', 'SQRT(X)', '1/X'],
		x2Trans: 'X2', //['X2', 'LN(X2)', 'SQRT(X2)', '1/X2'],
		x3Trans: 'X3', //['X3', 'LN(Y)', 'SQRT(Y)', '1/X3'],
		x4Trans: 'X4', //['X4', 'LN(X4)', 'SQRT(X4)', '1/X4'],
		x5Trans: 'X5', //['X5', 'LN(X5)', 'SQRT(X5)', '1/X5'],
		x6Trans: 'X6', //['X6', 'LN(X6)', 'SQRT(X6)', '1/X6'],
		x7Trans: 'X7', //['X7', 'LN(X7)', 'SQRT(X7)', '1/X7'],
		x8Trans: 'X8', //['X8', 'LN(X8)', 'SQRT(X8)', '1/X8'],
		Centered: options.Centered || false,
		LeastAbs: options.LeastAbs || false,
		cPctile: options.Percentile || 50 // Percentile
	};

	// initial parameters
	var parameters = {
		ca: options.initial[0] || 0,
		cb: options.initial[1] || 0,
		cc: options.initial[2] || 0,
		cd: options.initial[3] || 0,
		ce: options.initial[4] || 0,
		cf: options.initial[5] || 0,
		cg: options.initial[6] || 0,
		ch: options.initial[7] || 0,
		sa: 1.0,
		sb: 1.0,
		sc: 1.0,
		sd: 1.0,
		se: 1.0,
		sf: 1.0,
		sg: 1.0,
		sh: 1.0,
		pva: 0,
		pvb: 0,
		pvc: 0,
		pvd: 0,
		pve: 0,
		pvf: 0,
		pvg: 0,
		pvh: 0
	};

	// All functins and parameters
	function STUDT(r, t) {
		r = Math.abs(r);
		var n = r / Math.sqrt(t),
			a = Math.atan(n);
		if (1 == t) return 1 - a / (Math.PI / 2);
		var e = Math.sin(a),
			u = Math.cos(a);
		return t % 2 == 1 ? 1 - (a + e * u * STATCOM(u * u, 2, t - 3, -1)) / (Math.PI / 2) : 1 - e * STATCOM(u * u, 1, t - 3, -1)
	}

	function STATCOM(r, t, n, a) {
		for (var e = 1, u = e, c = t; c <= n;) e = e * r * c / (c - a), u += e, c += 2;
		return u;
	}

	function ASTUDT(r, t) {
		for (var n = .5, a = .5, e = 0; a > 1e-15;) e = 1 / n - 1, a /= 2, STUDT(e, t) > r ? n -= a : n += a;
		return e;
	}

	function MAX(r, t) {
		return r > t ? r : t;
	}

	function MIN(r, t) {
		return r < t ? r : t;
	}

	function Fmt(r) {
		var t;
		return Math.abs(r) < 5e-5 && (r = 0), t = r >= 0 ? " " + (r + 5e-5) : " " + (r - 5e-5), t = t.substring(0, t.indexOf(".") + 5), t.substring(t.length - 10, t.length)
	}

	function vFmt(r) {
		var t;
		return Math.abs(r) < 5e-7 && (r = 0), t = r >= 0 ? " " + (r + 5e-7) : " " + (r - 5e-7), t = t.substring(0, t.indexOf(".") + 7), t.substring(t.length - 18, t.length)
	}

	function ix(r, t) {
		return r * (presets.cPar + 1) + t
	}
	var Par = [0, 0, 0, 0, 0, 0, 0, 0],
		SEP = [1, 1, 1, 1, 1, 1, 1, 1],
		Der = [0, 0, 0, 0, 0, 0, 0, 0, 0],
		Arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		Cov = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		xArr = [0, 0, 0, 0, 0, 0, 0, 0, 0],
		i = 0,
		j = 0,
		k = 0,
		l = 0,
		m = 0,
		cPar = 0,
		cVar = 0,
		cPts = 0,
		ccSW = 1,
		ccAv = 0,
		ccSD = 1;

	// Iterating function
	function Iterate(r, a, P) {
		var r = r,
			t = 0,
			c = 0,
			x = 0;
		dgfr = a.cPts - a.cPar;
		var s = ASTUDT(.05, dgfr),
			A = a.cPctile / 100,
			e = P.ca;
		Par[0] = e;
		var S = P.cb;
		Par[1] = S;
		var T = P.cc;
		Par[2] = T;
		var n = P.cd;
		Par[3] = n;
		var o = P.ce;
		Par[4] = o;
		var M = P.cf;
		Par[5] = M;
		var f = P.cg;
		Par[6] = f;
		var h = P.ch;
		Par[7] = h;
		var E = "Y = " + a.equation + "\n";
		for (i = 1; i <= a.cVar; i++) E += " x" + i + " ";
		E += " Y yc Y-yc SEest YcLo YcHi \n";
		var m = 0;
		for (b = 0; b < a.cPar * (a.cPar + 1); b++) Arr[b] = 0;
		for (i = 1; i <= a.cPts; i++) {
			for (b = 0; b < a.cVar; b++) xArr[b] = r[i - 1][0], v = r[i - 1][1];
			var g = xArr[0];
			"LN(X2)" == a.x1Trans && (g = Math.log(xArr[0])), "SQRT(X2)" == a.x2Trans && (g = Math.sqrt(xArr[0])), "1/X2" == a.x2Trans && (g = 1 / xArr[0]);
			var q = g,
				D = xArr[1];
			"LN(X2)" == a.x2Trans && (D = Math.log(xArr[1])), "SQRT(X2)" == a.x2Trans && (D = Math.sqrt(xArr[1])), "1/X2" == a.x2Trans && (D = 1 / xArr[1]);
			var X = xArr[2];
			"LN(X3)" == a.x3Trans && (X = Math.log(xArr[2])), "SQRT(X3)" == a.x3Trans && (X = Math.sqrt(xArr[2])), "1/X3" == a.x3Trans && (X = 1 / xArr[2]);
			var F = xArr[3];
			"LN(X4)" == a.x4Trans && (F = Math.log(xArr[3])), "SQRT(X4)" == a.x4Trans && (F = Math.sqrt(xArr[3])), "1/X4" == a.x4Trans && (F = 1 / xArr[3]);
			var d = xArr[4];
			"LN(X5)" == a.x5Trans && (d = Math.log(xArr[4])), "SQRT(X5)" == a.x5Trans && (d = Math.sqrt(xArr[4])), "1/X5" == a.x5Trans && (d = 1 / xArr[4]);
			var p = xArr[5];
			"LN(X6)" == a.x6Trans && (p = Math.log(xArr[5])), "SQRT(X6)" == a.x6Trans && (p = Math.sqrt(xArr[5])), "1/X6" == a.x6Trans && (p = 1 / xArr[5]);
			var R = xArr[6];
			"LN(X7)" == a.x7Trans && (R = Math.log(xArr[6])), "SQRT(X7)" == a.x7Trans && (R = Math.sqrt(xArr[6])), "1/X7" == a.x7Trans && (R = 1 / xArr[6]);
			var C = xArr[7];
			"LN(X8)" == a.x8Trans && (C = Math.log(xArr[7])), "SQRT(X8)" == a.x8Trans && (C = Math.sqrt(xArr[7])), "1/X8" == a.x8Trans && (C = 1 / xArr[7]);
			var l = Equation(a.equation, e, S, T, n, o, M, f, h, g, q);
			if (Y = r[i - 1][1], "Rep" == a.SEy) {
				var y = 1,
					L = Y,
					I = Y * Y;
				y += 1, L += Y, I += Y * Y, Y = L / y;
				var N = Math.sqrt(Math.abs(I / y - Y * Y) / y)
			}
			yo = Y;
			var U = 1;
			"w" == a.SEy && (U = v), "Rep" == a.SEy && (U = N), "Sqrt(Y)" == a.SEy && (U = Math.sqrt(Y)), 0 == U && (U = .001);
			var u = a.yTrans.toUpperCase(),
				Q = Y;
			"LN(Y)" == u && (Q = Math.log(Y)), "LN(SQRT)" == u && (Q = Math.sqrt(Y)), "1/Y" == u && (Q = 1 / Y), "LN(Y)" == u && (U /= Y), "SQRT(Y)" == u && (U /= Q), "1/Y" == u && (U = U / Y * Y), Y = Q, a.LeastAbs && (U *= Y < l ? MAX(Math.sqrt(A * Math.abs(Y - l)), .001 * Y) : MAX(Math.sqrt((1 - A) * Math.abs(Y - l)), .001 * Y)), t += 1 / (U * U), c += l / (U * U), x += (Y - ccAv) * (Y - ccAv) / (U * U);
			for (var b = 0; b < a.cPar; b++) {
				var W = Par[b];
				if (0 == Par[b]) var B = 1e-4;
				else var B = Par[b] / 1e3;
				Par[b] += B, e = Par[0], S = Par[1], T = Par[2], n = Par[3], o = Par[4], M = Par[5], f = Par[6], h = Par[7], ycIncr = Equation(a.equation, e, S, T, n, o, M, f, h, g, q), Der[b] = (ycIncr - l) / (B * U), a.Centered && (Par[b] -= B, e = Par[0], S = Par[1], T = Par[2], n = Par[3], o = Par[4], M = Par[5], f = Par[6], h = Par[7], ycDecr = Equation(a.equation, e, S, T, n, o, M, f, h, g, q), Der[b] = (ycIncr - ycDecr) / (2 * B * U)), Par[b] = W, e = Par[0], S = Par[1], T = Par[2], n = Par[3], o = Par[4], M = Par[5], f = Par[6], h = Par[7]
			}
			for (Der[a.cPar] = (Y - l) / U, m += Der[a.cPar] * Der[a.cPar], b = 0; b < a.cPar; b++)
				for (k = 0; k <= a.cPar; k++) Arr[ix(b, k)] = Arr[ix(b, k)] + Der[b] * Der[k];
			var V = 0;
			for (b = 0; b < a.cPar; b++)
				for (V += Cov[ix(b, b)] * Der[b] * Der[b], k = b + 1; k < a.cPar; k++) V += 2 * Cov[ix(b, k)] * Der[b] * Der[k];
			V = U * Math.sqrt(V);
			var _ = l,
				w = l - s * V,
				H = l + s * V;
			"LN(Y)" == u && (_ = Math.exp(l), w = Math.exp(w), H = Math.exp(H)), "SQRT(Y)" == u && (_ = l * l, w *= w, H *= H), "1/Y" == u && (_ = 1 / l, w = 1 / w, H = 1 / H), E += Fmt(yo) + Fmt(_) + Fmt(yo - _) + Fmt(V) + Fmt(w) + Fmt(H) + "\n"
		}
		ccSW = t, ccAv = c / ccSW, ccSD = x / ccSW;
		var j = (ccSD - m / ccSW) / ccSD,
			z = Math.sqrt(j);
		for (E += "\nCorr. Coeff. = " + vFmt(z) + "; r*r = " + vFmt(j), RMS = Math.sqrt(m / MAX(1, dgfr)), E += "\nRMS Error = " + vFmt(RMS) + "; d.f = " + dgfr + "; SSq = " + vFmt(m) + "\n", AIC = a.cPts * Math.log(m / a.cPts) + 2 * (a.cPar + 1), a.cPts >= a.cPar + 2 ? AICc = AIC + 2 * (a.cPar + 1) * (a.cPar + 1 + 1) / (a.cPts - (a.cPar + 1) - 1) : AICc = AIC, E += "AIC = " + vFmt(AIC) + "; AIC(corrected) = " + vFmt(AICc) + "\n", i = 0; i < a.cPar; i++) {
			var G = Arr[ix(i, i)];
			for (Arr[ix(i, i)] = 1, k = 0; k <= a.cPar; k++) Arr[ix(i, k)] = Arr[ix(i, k)] / G;
			for (b = 0; b < a.cPar; b++)
				if (i != b)
					for (G = Arr[ix(b, i)], Arr[ix(b, i)] = 0, k = 0; k <= a.cPar; k++) Arr[ix(b, k)] = Arr[ix(b, k)] - G * Arr[ix(i, k)]
		}
		var J = "\nParameter Estimates...\n",
			K = [];
		for (i = 0; i < a.cPar; i++) Par[i] = Par[i] + a.RelaxF * Arr[ix(i, a.cPar)], SEP[i] = RMS * Math.sqrt(Arr[ix(i, i)]), J += "p" + (i + 1) + "=" + vFmt(Par[i]) + " +/- " + vFmt(SEP[i]) + "; p=" + Fmt(STUDT(Par[i] / SEP[i], dgfr)) + "\n", K.push({
			name: "P" + (i + 1),
			value: Par[i],
			sd_error: SEP[i],
			p: STUDT(Par[i] / SEP[i], dgfr)
		});
		var O = "\nCovariance Matrix Terms and Error-Correlations...\n";
		for (b = 0; b < a.cPar; b++)
			for (k = b; k < a.cPar; k++) Cov[ix(b, k)] = Arr[ix(b, k)] * RMS * RMS, v = Arr[ix(b, k)] / Math.sqrt(Arr[ix(b, b)] * Arr[ix(k, k)]), O += "B(" + (b + 1) + "," + (k + 1) + ")=", b != k && (O += "B(" + (k + 1) + "," + (b + 1) + ")="), O += " ", O += Cov[ix(b, k)], O += "; r=" + v + "\n";
		return {
			text: E,
			ParameterEstimates: J,
			CovarianceMatrix: O,
			r2: vFmt(j),
			par: {
				ca: Par[0],
				sa: SEP[0],
				pva: vFmt(STUDT(Par[0] / SEP[0], dgfr)),
				cb: Par[1],
				sb: SEP[1],
				pvb: vFmt(STUDT(Par[1] / SEP[1], dgfr)),
				cc: Par[2],
				sc: SEP[2],
				pvc: vFmt(STUDT(Par[2] / SEP[2], dgfr)),
				cd: Par[3],
				sd: SEP[3],
				pvd: vFmt(STUDT(Par[3] / SEP[3], dgfr)),
				ce: Par[4],
				se: SEP[4],
				pve: vFmt(STUDT(Par[4] / SEP[4], dgfr)),
				cf: Par[5],
				sf: SEP[5],
				pvf: vFmt(STUDT(Par[5] / SEP[5], dgfr)),
				cg: Par[6],
				sg: SEP[6],
				pvg: vFmt(STUDT(Par[6] / SEP[6], dgfr)),
				ch: Par[7],
				sh: SEP[7],
				pvh: vFmt(STUDT(Par[7] / SEP[7], dgfr))
			},
			parameters: K,
			RMS_error: RMS,
			presets: presets
		}
	}

	// Function library
	function Equation(eqtn, a, b, c, d, e, f, g, h, x, t) {
		if (eqtn == 'b + a * e(- x / c)')
			return b + a * Math.exp(-x / c)
		if (eqtn == '( a - c ) * e( - b * t ) + c')
			return (a - c) * Math.exp(-b * t) + c
		if (eqtn == '( c + a / ( 1 + b / x ) )')
			return ( c + a / ( 1 + b / x ) );
		if (eqtn == '( c + a * a / ( 1 + b / x ) )')
			return ( c + a * a / ( 1 + b / x ) );
		return null;
	}

	// iteration loop
	var output = {};
	var convergence;
	var rmsarr = [];
	for (it = 0; it < presets.iterations; it++) {
		var tmp = Iterate(data, presets, parameters);
		if (convergence <= tmp.RMS_error && it > 1 || isNaN(tmp.RMS_error))
			break;
		parameters = tmp.par;
		convergence = tmp.RMS_error;
		output = tmp;
		rmsarr.push(tmp.RMS_error);
	}
	output.iterations = it;
	output.RMS_errors = rmsarr;
	delete output.par
	return output;
}/**
 * The function transforms a given array by providing a second same length array, or a single number.
 * @access public
 * @param {('add'|'subtract'|'multiply'|'divide'|'+'|'-'|'*'|'/'|'normToMin'|'normToMax'|'normToRange'|'normToIdx'|'normToVal'|'ma'|'sgf'|'abs')} fn Available functions to transform the input array.
 * @param {number[]} a1 Input array.
 * @param {number|number[]} [a2] Second array or single number
 * @returns {number[]|void} Transformed array or null
 * @example TransformTrace('subtract', [1, 2, 3, 4], [0, 1, 2, 1]);
 * // returns [1, 1, 1, 3]
 *
 * TransformTrace('add', [1, 2, 3, 4], [0, 1, 2, 1]);
 * // returns [1, 3, 5, 5]
 *
 * TransformTrace('add', [1, 2, 3, 4], 5);
 * // returns [6, 7, 8, 9]
 *
 * TransformTrace('normToMin', [1.5, 2, 3, 4]);
 * // returns [1, 1.3333, 2, 2.6665]
 *
 * TransformTrace('normToMax', [1.5, 2, 3, 4]);
 * // returns [0.375, 0.5, 0.75, 1]
 *
 * TransformTrace('normToRange', [1.5, 2, 3, 4]);
 * // returns [0, 0.2, 0.6, 1]
 *
 * TransformTrace('normToIdx', [1.5, 2, 3, 4], 1);
 * // returns [0.75, 1, 1.5, 2]
 *
 * TransformTrace('normToVal', [1, 2, 3, 4], 2);
 * // returns [0.75, 1, 1.5, 2]
 *
 * // Smoothing (ma= Moving average, sgf= Savitzky-Golay filter)
 *
 * TransformTrace('ma', [1.5, 2, 3, 4]);
 * // returns [1.6667, 2.1665, 3, 3.6665]
 *
 * TransformTrace('sgf', [1, 2, 3, 4]);
 * // returns [6, 7, 8, 9]
 *
 * // Absorbance (abs) -log(I/I0)
 *
 * // In case no value is provided, I0 is the fist value from the array
 * TransformTrace('abs', [1.5, 2, 3, 4]);
 * // returns [-0, -0.12494, -0.30103, -0.42597]
 *
 * // The provided value is I0
 * TransformTrace('abs', [1.5, 2, 3, 4], 1);
 * // returns [-0.1761, -0.3010, -0.4771, -0.6021]
 */

function TransformTrace( fn, a1, a2 ) {

    // Available functions for transformation
    var fns = ['add','subtract','multiply','divide','+','-','*','/','normToMin','normToMax','normToRange','normToIdx','normToVal','ma','sgf','abs'];
    var trace = [];
    var issue = null;

    // Making sure user input meets minimum requirements
    if( fn === undefined || fns.indexOf(fn) == -1 || a1 === undefined || !Array.isArray(a1) )
        return 'Unknown Function';

    // Making sure input for a2 is a valid array
    if( a2 !== undefined && Array.isArray(a2) && a1.length != a2.length )
        return 'Arrays have different sizes (a1 = '+a1.length+', a2 = '+a2.length+')';

    // Making sure input for a2 is a number otherwise
    else if( a2 !== undefined && !Array.isArray(a2) && typeof a2 != 'number' )
        return 'Input for third parameter needs to be an array or number';

    if(typeof a2 == 'number'){
        trace = a1.map(function(a){
            if(fn == 'add' || fn == '+'){
                return a + a2;
            }
            if(fn == 'subtract' || fn == '-'){
                return a - a2;
            }
            if(fn == 'multiply' || fn == '*'){
                return a * a2;
            }
            if(fn == 'divide' || fn == '/' || fn == 'normToVal'){
                return a / a2;
            }
            if(fn == 'normToIdx'){
                return a / a1[a2];
            }
            if(fn == 'abs'){
                return ( - Math.log( ( a / a2) ) / Math.LN10 );
            }
        });
    }

    else if(a2 === undefined){
        if(fn == 'normToMin'){
            var min = Math.min.apply(Math, a1);
            trace = a1.map(function(a){
                return a / min;
            });
        }
        if(fn == 'normToMax'){
            var max = Math.max.apply(Math, a1);
            trace = a1.map(function(a){
                return a / max;
            });
        }

        if(fn == 'normToRange'){
            var min = Math.min.apply(Math, a1);
            var max = Math.max.apply(Math, a1);
            trace = a1.map(function(a){
                return ((a - min) / (max - min));
            });
        }

        if(fn == 'ma'){
            var tmp = [];
            // We have to extend the trace by one on each side to calculate the points in the beginning
            a1.unshift(a1[0]);
            a1.push(a1[a1.length - 1]);
            for (var i = 1, len = a1.length; i < len - 1; i++) {
                tmp.push((a1[i] + a1[i - 1] + a1[i + 1]) / 3);
            }
            trace = tmp;
        }

        if(fn == 'sgf'){
            var len = a1.length;
            var beg0 = a1[0];
            var beg1 = a1[1];
            var beg2 = a1[2];

            var end0 = a1[len - 1];
            var end1 = a1[len - 2];
            var end2 = a1[len - 3];

            var tmp = [];
            a1.unshift(beg2, beg1, beg0);
            a1.push(end0, end1, end2);
            for (var i = 3; i < len - 3; i++) {
                tmp.push( (-2 * a1[i - 3] + 3 * a1[i - 2] + 6 * a1[i - 1] + 7 * a1[i] + 6 * a1[i + 1] + 3 * a1[i + 2] + -2 * a1[i + 2]) / 21 );
            }
            trace = tmp;
        }

        if(fn == 'abs'){
            for (var i in a1)
                trace.push( ( - Math.log( (a1[i] / a1[0]) ) / Math.LN10 ) );
        }
    }

    else if(typeof a2 == 'string'){
        trace = a1.map(function(a){
            if(fn == 'add' || fn == '+'){
                return a + a2;
            }
            if(fn == 'subtract' || fn == '-'){
                return a - a2;
            }
            if(fn == 'multiply' || fn == '*'){
                return a * a2;
            }
            if(fn == 'divide' || fn == '/'){
                return a / a2;
            }
        });
    }

    else if( Array.isArray(a2) ){
        for(var i in a1){
            if(fn == 'add' || fn == '+'){
                trace.push( a1[i] + a2[i] );
            }
            if(fn == 'subtract' || fn == '-'){
                trace.push( a1[i] - a2[i] );
            }
            if(fn == 'multiply' || fn == '-'){
                trace.push( a1[i] * a2[i] );
            }
            if(fn == 'divide' || fn == '/'){
                trace.push( a1[i] / a2[i] );
            }
        }
    }

    else{
        return null;
    }

    return issue ? null : trace;
}
//Multiple Linear Regression: Input -> Array with values [predictor 1, predictor 2, ...etc, response] (float or int) */
//source: numericjs
function MathMULTREG(input_raw) {

	//do some basic transforms on the data to get it to useable form
	var numPredictors = input_raw[0].length - 1;
	var input = [];

	for (var i = 0; i < input_raw[0].length; i++) {
		var temp = [];
		for (var j = 0; j < input_raw.length; j++) {
			temp.push(input_raw[j][i]);
		}
		input.push(temp);
	}


	var x = [];
	var ones = [];
	for (i = 0; i < input[0].length; i++) {
		ones.push(1);
	}

	x.push(ones);
	var retX = [];
	for (i = 0; i < numPredictors; i++) {
		x.push(input[i]);
		retX.push(input[i]);
	}

	var y = input[numPredictors];

	//do the actual fit
	x = transpose(x);

	var qr = QRDecomp(x);

	var results = dot(inv(qr.R), dot(transpose(qr.Q), y));

	//calculate the rsquared value
	var sum = 0;
	for (i = 0; i < y.length; i++) {
		sum += y[i];
	}

	var responseAvg = sum / y.length;

	var yHat = [];

	for (i = 0; i < y.length; i++) {
		var yTemp = 0;
		for (j = 0; j < numPredictors; j++) {
			yTemp += results[j + 1] * x[i][j + 1];
		}
		yTemp += results[0];
		yHat.push(yTemp);
	}

	var SSM = 0;
	var SSTO = 0;

	for (i = 0; i < y.length; i++) {
		SSM += ((yHat[i] - responseAvg) * (yHat[i] - responseAvg));
		SSTO += ((y[i] - responseAvg) * (y[i] - responseAvg));
	}

	var rSq = SSM / SSTO;

	return {
		"rsquared": rSq,
		"slopes": results,
		"points": [retX, yHat]
	};

}

/**
//Fit to Y = Y0 + Ae^(-x/t), where A and t are the fitted variables, takes an array of floats or ints
//Format of input should be [predictor, response]
*/
//------------------------------------------------------------------------------------------------------------------
function MathEXPINVREG(input_raw) {

	//calculate the approximate asymptote
	var y = [];
	for (i = 0; i < input_raw.length; i++) {
		y.push(input_raw[i][1]);
	}

	//trapezoidal riemann sum assuming spaced evenly
	var riemann = 0;
	var riemannSq = 0;
	for (i = 0; i < y.length - 1; i++) {
		temp = (y[i] + y[i + 1]) / 2;
		riemann += temp;
		temp = (Math.pow(y[i], 2) + Math.pow(y[i + 1], 2)) / 2;
		riemannSq += temp;
	}

	var asymptote = (riemannSq - riemann * (y[0] + y[y.length - 1]) / 2) /
		(riemann - y.length * (y[0] + y[y.length - 1]) / 2);

	//calculate with linear regression on the linear equation ln(Y) = ln(A) - x/t
	var input_transformed = clone(input_raw);
	for (var i = 0; i < input_raw.length; i++) {
		temp = input_raw[i][1] - asymptote;
		if (temp < 0) {
			temp = -1 * temp;
		}
		input_transformed[i][1] = MathLN(temp);
	}



	var constants = [0.5];

	var t2 = 50;
	var t2_old;
	var t, A;
	for (i = 0; i < 10; i++) {

		if (t2 < 2) {
			t = -999999;
			A = 0;
			break;
		}

		t2_old = t2;
		var linReg = MathMULTREG(input_transformed.slice(0, t2));

		t2 = MathROUND((-1 / linReg.slopes[1]) * constants[0], 0);
		if (i == 9) {
			t2 = (t2 > t2_old) ? t2 : t2_old;
			linReg = MathMULTREG(input_transformed.slice(0, t2));
		}

		t = linReg.slopes[1];
		A = Math.pow(Math.E, linReg.slopes[0]);

	}



	var points = [];
	for (i = 0; i < input_raw.length; i++) {
		var temp = [];
		temp.push(input_raw[i][0]);
		temp.push(A * Math.pow(Math.E, input_raw[i][0] * t) + asymptote);
		points.push(temp);
	}

	var yError = 0;
	for (i = 0; i < input_raw.length; i++) {
		yError += Math.pow(A * Math.pow(Math.E, input_raw[i][0] * t) - input_raw[i][1] + asymptote, 2);
	}

	yError /= input_raw.length - 1;

	var lifetime = (-1 / t);
	var slope = -1 * A * t;

	return {
		points: points,
		results: [A, t],
		error: yError,
		asymptote: asymptote,
		rsquared: linReg.rsquared,
		lifetime: lifetime,
		slope: slope
	};
}

//Polynomial fit - fit to y = a0 + a1x + a2x^2 + a3x^3....
//Format of input_raw is [predictor, response], degree must be an int
//------------------------------------------------------------------------------------------------------------------
function MathPOLYREG(input_raw, degree) {
	var transformed_nums = [];
	for (var i = 0; i < input_raw.length; i++) {
		var temp = [];
		for (var j = 1; j < degree + 1; j++) {
			temp.push(Math.pow(input_raw[i][0], j))
		}
		temp.push(input_raw[i][1]);
		transformed_nums.push(temp);
	}

	var polyReg = MathMULTREG(transformed_nums);

	var slopes = polyReg.slopes;

	var points = [];
	var yError = 0;
	for (i = 0; i < input_raw.length; i++) {
		temp = [];
		var yHat = 0;
		temp.push(input_raw[i][0]);
		for (j = 0; j < degree + 1; j++) {
			yHat += (Math.pow(input_raw[i][0], degree) * slopes[j]);
		}
		temp.push(yHat);
		points.push(temp);

		yError += Math.pow((yHat - input_raw[i][1]), 2);
	}

	yError /= input_raw.length - 1;

	return {
		"points": points,
		"slopes": slopes,
		"error": yError
	};

}

/** Calculate the angular difference between the device and the sun given roll, pitch, compass, azimuth, altitude */
function calcSunAngle(roll, pitch, compass, azimuth, altitude) {
	var cos = Math.cos;
	var sin = Math.sin;
	var pi = Math.PI;
	var acos = Math.acos;

	roll *= pi / 180;
	pitch *= pi / 180;
	compass *= pi / 180;
	azimuth *= pi / 180;
	altitude *= pi / 180;

	//rotate by roll and pitch
	var deviceVector = [cos(roll) * sin(pitch), -1 * sin(roll), cos(roll) * cos(pitch)];

	//rotate by compass
	deviceVector[0] = cos(compass) * deviceVector[0] - sin(compass) * deviceVector[1];
	deviceVector[1] = sin(compass) * deviceVector[0] - cos(compass) * deviceVector[1];

	var solarVector = [cos(azimuth) * cos(altitude), sin(azimuth), -1 * cos(azimuth) * sin(altitude)];

	var percent = solarVector[0] * deviceVector[0] + solarVector[1] * deviceVector[1] + solarVector[2] * deviceVector[2];

	return {
		"angle": acos(percent) * 180 / pi,
		"percent": percent
	};
}

//intended for vectors of equal size
function subVV(vec1, vec2) {
	var ret = [];
	for (var i = 0; i < vec1.length; i++) {
		ret.push(vec1[i] - vec2[i]);
	}

	return ret;
}

function proj(vec1, vec2) {
	var denom = innerProd(vec1, vec1);
	var numer = innerProd(vec1, vec2);

	var vec3 = [];

	for (var i = 0; i < vec1.length; i++) {
		vec3[i] = (numer / denom) * vec1[i];
	}

	return vec3;
}

function innerProd(vec1, vec2) {
	if (vec1.length == vec2.length) {
		var ans = 0;
		for (var i = 0; i < vec1.length; i++) {
			ans += vec1[i] * vec2[i];
		}

		return ans;
	}
}

function normal(vec) {
	var norm = 0;
	for (var i = 0; i < vec.length; i++) {
		norm += vec[i] * vec[i];
	}
	norm = Math.sqrt(norm);

	return norm;
}

//source: http://www.learninglover.com/examples.php?id=79
function QRDecomp(A) {
	var aVectors = transpose(A);
	var uVector = [];
	var eVector = [];
	var eVectorTxt = [];
	var sum = [];

	var testTest = [];

	for (var i = 0; i < aVectors.length; i++) {
		uVector[i] = [];
		for (var j = 0; j < aVectors[i].length; j++) {
			sum[j] = 0;
		}

		for (j = 0; j < i; j++) {
			var temp = proj(eVector[j], aVectors[i]);
			for (k = 0; k < temp.length; k++) {
				sum[k] += temp[k];
			}
		}

		for (j = 0; j < aVectors[i].length; j++) {
			uVector[i][j] = aVectors[i][j] - sum[j];
		}

		var norm = normal(uVector[i]);

		eVector[i] = [];
		eVectorTxt[i] = [];

		for (j = 0; j < aVectors[i].length; j++) {
			eVector[i][j] = uVector[i][j] / norm;
			eVectorTxt[i][j] = uVector[i][j] + " / " + norm;
		}


	}

	for (i = 0; i < aVectors.length; i++) {
		testTest[i] = [];
		for (j = 0; j < aVectors[i].length; j++) {
			testTest[i][j] = 0;
		}

		for (j = 0; j <= i; j++) {
			var tempVec = innerProd(aVectors[i], eVector[j]);

			for (var k = 0; k < eVector[i].length; k++) {
				testTest[i][k] += eVector[j][k] * tempVec;
			}
		}


	}

	eVector = transpose(eVector);
	eVectorTxt = transpose(eVectorTxt);
	var decomp = {};
	decomp.Q = [];

	for (i = 0; i < eVector.length; i++) {
		decomp.Q[i] = eVectorTxt[i];
	}

	for (i = 0; i < eVector.length; i++) {
		decomp.Q[i] = eVector[i];
	}

	decomp.R = dot(transpose(decomp.Q), A);

	return decomp;
}

//helper functions from numeric.js library
function transpose(x) {
	var i, j, m = x.length,
		n = x[0].length,
		ret = new Array(n),
		A0, A1, Bj;
	for (j = 0; j < n; j++) ret[j] = new Array(m);
	for (i = m - 1; i >= 1; i -= 2) {
		A1 = x[i];
		A0 = x[i - 1];
		for (j = n - 1; j >= 1; --j) {
			Bj = ret[j];
			Bj[i] = A1[j];
			Bj[i - 1] = A0[j];
			--j;
			Bj = ret[j];
			Bj[i] = A1[j];
			Bj[i - 1] = A0[j];
		}
		if (j === 0) {
			Bj = ret[0];
			Bj[i] = A1[0];
			Bj[i - 1] = A0[0];
		}
	}
	if (i === 0) {
		A0 = x[0];
		for (j = n - 1; j >= 1; --j) {
			ret[j][0] = A0[j];
			--j;
			ret[j][0] = A0[j];
		}
		if (j === 0) {
			ret[0][0] = A0[0];
		}
	}
	return ret;
}

function _getCol(A, j, x) {
	var n = A.length,
		i;
	for (i = n - 1; i > 0; --i) {
		x[i] = A[i][j];
		--i;
		x[i] = A[i][j];
	}
	if (i === 0) x[0] = A[0][j];
}

function dotVV(x, y) {
	var i, n = x.length,
		i1, ret = x[n - 1] * y[n - 1];
	for (i = n - 2; i >= 1; i -= 2) {
		i1 = i - 1;
		ret += x[i] * y[i] + x[i1] * y[i1];
	}
	if (i === 0) {
		ret += x[0] * y[0];
	}
	return ret;
}

function dotMMbig(x, y) {
	var gc = _getCol,
		p = y.length,
		v = new Array(p);
	var m = x.length,
		n = y[0].length,
		A = new Array(m),
		xj;
	var VV = dotVV;
	var i, j;
	--p;
	--m;
	for (i = m; i !== -1; --i) A[i] = new Array(n);
	--n;

	for (i = n; i !== -1; --i) {
		gc(y, i, v);
		for (j = m; j !== -1; --j) {
			xj = x[j];
			A[j][i] = VV(xj, v);
		}
	}

	return A;
}

function _dim(x) {
	var ret = [];
	while (typeof x === "object") {
		ret.push(x.length);
		x = x[0];
	}
	return ret;
}

function dim(x) {
	var y, z;
	if (typeof x === "object") {
		y = x[0];
		if (typeof y === "object") {
			z = y[0];
			if (typeof z === "object") {
				return _dim(x);
			}
			return [x.length, y.length];
		}
		return [x.length];
	}
	return [];
}

function clone(input) {
	var ret = [];
	for (var i = 0; i < input.length; i++) {
		var temp = [];
		for (var j = 0; j < input[0].length; j++) {
			temp.push(input[i][j]);
		}
		ret.push(temp);
	}

	return ret;
}

function diag(d) {
	var i, i1, j, n = d.length,
		A = new Array(n),
		Ai;
	for (i = n - 1; i >= 0; i--) {
		Ai = new Array(n);
		i1 = i + 2;
		for (j = n - 1; j >= i1; j -= 2) {
			Ai[j] = 0;
			Ai[j - 1] = 0;
		}
		if (j > i) {
			Ai[j] = 0;
		}
		Ai[i] = d[i];
		for (j = i - 1; j >= 1; j -= 2) {
			Ai[j] = 0;
			Ai[j - 1] = 0;
		}
		if (j === 0) {
			Ai[0] = 0;
		}
		A[i] = Ai;
	}
	return A;
}

function rep(s, v, k) {
	if (typeof k === "undefined") {
		k = 0;
	}
	var n = s[k],
		ret = new Array(n),
		i;
	if (k === s.length - 1) {
		for (i = n - 2; i >= 0; i -= 2) {
			ret[i + 1] = v;
			ret[i] = v;
		}
		if (i === -1) {
			ret[0] = v;
		}
		return ret;
	}
	for (i = n - 1; i >= 0; i--) {
		ret[i] = rep(s, v, k + 1);
	}
	return ret;
}

function identity(n) {
	return diag(rep([n], 1));
}

function inv(x) {
	var s = dim(x),
		abs = Math.abs,
		m = s[0],
		n = s[1];
	var A = clone(x),
		Ai, Aj;
	var I = identity(m),
		Ii, Ij;
	var i, j, k;
	for (j = 0; j < n; ++j) {
		var i0 = -1;
		var v0 = -1;
		for (i = j; i !== m; ++i) {
			k = abs(A[i][j]);
			if (k > v0) {
				i0 = i;
				v0 = k;
			}
		}
		Aj = A[i0];
		A[i0] = A[j];
		A[j] = Aj;
		Ij = I[i0];
		I[i0] = I[j];
		I[j] = Ij;
		x = Aj[j];
		for (k = j; k !== n; ++k) Aj[k] /= x;
		for (k = n - 1; k !== -1; --k) Ij[k] /= x;
		for (i = m - 1; i !== -1; --i) {
			if (i !== j) {
				Ai = A[i];
				Ii = I[i];
				x = Ai[j];
				for (k = j + 1; k !== n; ++k) Ai[k] -= Aj[k] * x;
				for (k = n - 1; k > 0; --k) {
					Ii[k] -= Ij[k] * x;
					--k;
					Ii[k] -= Ij[k] * x;
				}
				if (k === 0) Ii[0] -= Ij[0] * x;
			}
		}
	}
	return I;
}

function dotMV(x, y) {
	var p = x.length,
		i;
	var ret = new Array(p);
	var VV = dotVV;
	for (i = p - 1; i >= 0; i--) {
		ret[i] = VV(x[i], y);
	}
	return ret;
}

function dotVM(x, y) {
	var j, k, p, q, ret, woo, i0;
	p = x.length;
	q = y[0].length;
	ret = new Array(q);
	for (k = q - 1; k >= 0; k--) {
		woo = x[p - 1] * y[p - 1][k];
		for (j = p - 2; j >= 1; j -= 2) {
			i0 = j - 1;
			woo += x[j] * y[j][k] + x[i0] * y[i0][k];
		}
		if (j === 0) {
			woo += x[0] * y[0][k];
		}
		ret[k] = woo;
	}
	return ret;
}

function dotMMsmall(x, y) {
	var i, j, k, p, q, r, ret, foo, bar, woo, i0;
	p = x.length;
	q = y.length;
	r = y[0].length;
	ret = new Array(p);
	for (i = p - 1; i >= 0; i--) {
		foo = new Array(r);
		bar = x[i];
		for (k = r - 1; k >= 0; k--) {
			woo = bar[q - 1] * y[q - 1][k];
			for (j = q - 2; j >= 1; j -= 2) {
				i0 = j - 1;
				woo += bar[j] * y[j][k] + bar[i0] * y[i0][k];
			}
			if (j === 0) {
				woo += bar[0] * y[0][k];
			}
			foo[k] = woo;
		}
		ret[i] = foo;
	}
	return ret;
}

function mulVS(x, y) {
	for (var i = 0; i < x.length; i++) {
		x[i] = x[i] * y;
	}

	return x;
}

function mulSV(x, y) {
	for (var i = 0; i < y.length; i++) {
		y[i] = y[i] * x;
	}

	return y;
}

function dot(x, y) {
	var d = dim;
	switch (d(x).length * 1000 + d(y).length) {
		case 2002:
			if (y.length < 10) return dotMMsmall(x, y);
			else return dotMMbig(x, y);
		case 2001:
			return dotMV(x, y);
		case 1002:
			return dotVM(x, y);
		case 1001:
			return dotVV(x, y);
		case 1000:
			return mulVS(x, y);
		case 1:
			return mulSV(x, y);
		case 0:
			return x * y;
		default:
			throw new Error('numeric.dot only works on vectors and matrices');
	}
}/**
 * Math.abs(x) returns the absolute value of x
 * @see {@link https://www.w3schools.com/jsref/jsref_abs.asp}
 * @access public
 * @name Math.abs
 * @param {number} x
 * @returns {number}
 * @example Math.abs(4.7);
 * // returns 5
 * Math.abs(4.4);
 * // returns 4;
 */

/**
 * Math.acos(x) returns the arccosine of x, in radians
 * @see {@link https://www.w3schools.com/jsref/jsref_acos.asp}
 * @access public
 * @name Math.acos
 * @param {number} x
 * @returns {number}
 * @example Math.acos(0.5);
 * // returns 1.0471975511965979
 */

/**
 * Math.asin(x) returns the arcsine of x, in radians
 * @see {@link https://www.w3schools.com/jsref/jsref_asin.asp}
 * @access public
 * @name Math.asin
 * @param {number} x
 * @returns {number}
 * @example Math.asin(0.5);
 * // returns 0.5235987755982989
 */

/**
 * Math.atan(x) returns the arctangent of x as a numeric value between -PI/2 and PI/2 radians
 * @see {@link https://www.w3schools.com/jsref/jsref_atan.asp}
 * @access public
 * @name Math.atan
 * @param {number} x
 * @returns {number}
 * @example Math.atan(0.5);
 * // returns 0.4636476090008061
 */

/**
 * Math.atan2(y, x) returns the arctangent of the quotient of its arguments
 * @see {@link https://www.w3schools.com/jsref/jsref_atan2.asp}
 * @access public
 * @name Math.atan2
 * @param {number} x
 * @param {number} y
 * @returns {number}
 * @example Math.atan2(0.5,2);
 * // returns 0.24497866312686414
 */

/**
 * Math.ceil(x) returns the value of x rounded up to its nearest integer
 * @see {@link https://www.w3schools.com/jsref/jsref_ceil.asp}
 * @access public
 * @name Math.ceil
 * @param {number} x
 * @returns {number}
 * @example Math.ceil(4.7);
 * // returns 5
 */

/**
 * Math.cos(x) returns the cosine of x (x is in radians)
 * @see {@link https://www.w3schools.com/jsref/jsref_cos.asp}
 * @access public
 * @name Math.cos
 * @param {number} x
 * @returns {number}
 * @example Math.cos(1);
 * // returns 0.5403023058681398
 */

/**
 * Math.exp(x) returns the value of Ex
 * @see {@link https://www.w3schools.com/jsref/jsref_exp.asp}
 * @access public
 * @name Math.exp
 * @param {number} x
 * @returns {number}
 * @example Math.exp(3);
 * // returns 20.085536923187668
 */

/**
 * Math.floor(x) returns the value of x rounded down to its nearest integer
 * @see {@link https://www.w3schools.com/jsref/jsref_floor.asp}
 * @access public
 * @name Math.floor
 * @param {number} x
 * @returns {number}
 * @example Math.floor(4.7);
 * // returns 4
 */

/**
 * Math.log(x) returns the natural logarithm (base E) of x
 * @see {@link https://www.w3schools.com/jsref/jsref_log.asp}
 * @access public
 * @name Math.log
 * @param {number} x
 * @returns {number}
 * @example Math.log(4.7);
 * // returns 1.547562508716013
 */

/**
 * Math.max(x, y, z, ..., n) returns the number with the highest value
 * @see {@link https://www.w3schools.com/jsref/jsref_max.asp}
 * @access public
 * @name Math.max
 * @param {number} x
 * @returns {number}
 * @example Math.max(0, 150, 30, 20, -8, -200);
 * // returns 150
 */

/**
 * Math.min(x, y, z, ..., n) returns the number with the lowest value
 * @see {@link https://www.w3schools.com/jsref/jsref_min.asp}
 * @access public
 * @name Math.min
 * @param {number} x
 * @returns {number}
 * @example Math.min(0, 150, 30, 20, -8, -200);
 * // returns -200
 */

/**
 * Math.pow(x, y) returns the value of x to the power of y
 * @see {@link https://www.w3schools.com/jsref/jsref_pow.asp}
 * @access public
 * @name Math.pow
 * @param {number} x
 * @param {number} y
 * @returns {number}
 * @example Math.pow(3,2);
 * // returns 9
 */

/**
 * Math.round(x) returns the value of x rounded to its nearest integer
 * @see {@link https://www.w3schools.com/jsref/jsref_round.asp}
 * @access public
 * @name Math.round
 * @param {number} x
 * @returns {number}
 * @example Math.round(4.7);
 * // returns 5
 * Math.round(4.4);
 * // returns 4
 */

/**
 * Math.sin(x) returns the sine of x (x is in radians)
 * @see {@link https://www.w3schools.com/jsref/jsref_sin.asp}
 * @access public
 * @name Math.sin
 * @param {number} x
 * @returns {number}
 * @example Math.sin(1);
 * // returns 0.8414709848078965
 */

/**
 * Math.sqrt(x)	returns the square root of x
 * @see {@link https://www.w3schools.com/jsref/jsref_sqrt.asp}
 * @access public
 * @name Math.sqrt
 * @param {number} x
 * @returns {number}
 * @example Math.sqrt(2);
 * // returns 1.4142135623730951
 */

/**
 * Math.tan(x) returns the tangent of an angle
 * @see {@link https://www.w3schools.com/jsref/jsref_tan.asp}
 * @access public
 * @name Math.tan
 * @param {number} x
 * @returns {number}
 * @example Math.tan(1);
 * // returns 1.5574077246549023
 */

/**
 * Euler's number (approx. 2.718)
 * @see {@link https://www.w3schools.com/jsref/jsref_e.asp}
 * @access public
 * @name Math.E
 * @returns {number} 2.718281828459045
 * @example Math.E;
 * // returns 2.718281828459045
 */

/**
 * Natural logarithm of 2 (approx. 0.693)
 * @see {@link https://www.w3schools.com/jsref/jsref_ln2.asp}
 * @access public
 * @name Math.LN2
 * @returns {number} 0.6931471805599453
 * @example Math.LN2;
 * // returns 0.6931471805599453
 */

/**
 * Natural logarithm of 10 (approx. 2.302)
 * @see {@link https://www.w3schools.com/jsref/jsref_ln10.asp}
 * @access public
 * @name Math.LN10
 * @returns {number} 2.302585092994046
 * @example Math.LN10;
 * // returns 2.302585092994046
 */

/**
 * Base-2 logarithm of E (approx. 1.442)
 * @see {@link https://www.w3schools.com/jsref/jsref_log2e.asp}
 * @access public
 * @name Math.LOG2E
 * @returns {number} 1.4426950408889634
 * @example Math.LOG2E;
 * // returns 1.4426950408889634
 */

/**
 * Base-10 logarithm of E (approx. 0.434)
 * @see {@link https://www.w3schools.com/jsref/jsref_log10e.asp}
 * @access public
 * @name Math.LOG10E
 * @returns {number} 0.4342944819032518
 * @example Math.LOG10E;
 * // returns 0.4342944819032518
 */

/**
 * PI (approx. 3.14)
 * @see {@link https://www.w3schools.com/jsref/jsref_pi.asp}
 * @access public
 * @name Math.PI
 * @returns {number} 3.141592653589793
 * @example Math.PI;
 * // returns 3.141592653589793
 */

/**
 * Square root of 1/2 (approx. 0.707)
 * @see {@link https://www.w3schools.com/jsref/jsref_sqrt1_2.asp}
 * @access public
 * @name Math.SQRT1_2
 * @returns {number} 0.7071067811865476
 * @example Math.SQRT1_2;
 * // returns 0.7071067811865476
 */

/**
 * Square root of 2 (approx. 1.414)
 * @see {@link https://www.w3schools.com/jsref/jsref_sqrt2.asp}
 * @access public
 * @name Math.SQRT2
 * @returns {number} 1.4142135623730951
 * @example Math.SQRT2;
 * // returns 1.4142135623730951
 */

/**
 * Random number
 * @see {@link https://www.w3schools.com/jsref/jsref_random.asp}
 * @access public
 * @name Math.random
 * @returns {number} between 0 and 1
 * @example Math.random();
 * // returns a random number
 */
