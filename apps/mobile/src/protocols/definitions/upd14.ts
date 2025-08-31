/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion,@typescript-eslint/ban-ts-comment */
/**
 * Macro for measurements of light potential, and more.
 * data on PhotosynQ.org
 * by: LC and DMK
 * created: 2025-02-26 @ 00:00:00
 */

interface Protocol {
  label?: string;
  [key: string]: any;
}
interface ProtocolData {
  set?: Protocol[];
}

const danger = console.warn;

/**
 * Returns the protocol(s) from within the protocol set matching the provided label.
 *
 * @param label The label to match
 * @param data The protocol data
 * @param array Whether to always return an array
 * @returns A single protocol or an array of protocols
 */
function GetProtocolByLabel(label?: string, data?: ProtocolData, array = false): any {
  if (!label || !data || !Array.isArray(data.set)) {
    return null;
  }

  const matches = data.set.filter((item) => item.label === label);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return array ? matches : matches[0];
  }

  return matches;
}

function MathROUND(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function MathMEAN(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

function ArrayNth(array: any[], depth: number, index: number): any[] {
  if (!Array.isArray(array)) return [];

  let result = array;

  for (let d = 1; d < depth; d++) {
    result = result.flatMap((item) => (Array.isArray(item) ? item : []));
  }

  return result.map((item) => (Array.isArray(item) && item.length > index ? item[index] : null));
}

function TransformTrace(
  operation: string,
  array: number[],
  secondArg?: number[] | number,
): number[] {
  if (!Array.isArray(array) || array.length === 0) return [];

  switch (operation) {
    case "add":
    case "+":
      if (Array.isArray(secondArg)) {
        return array.map((x, i) => x + (secondArg[i] ?? 0));
      }
      return array.map((x) => x + secondArg!);

    case "subtract":
    case "-":
      if (Array.isArray(secondArg)) {
        return array.map((x, i) => x - (secondArg[i] ?? 0));
      }
      return array.map((x) => x - secondArg!);

    case "multiply":
    case "*":
      if (Array.isArray(secondArg)) {
        return array.map((x, i) => x * (secondArg[i] ?? 1));
      }
      return array.map((x) => x * secondArg!);

    case "divide":
    case "/":
      if (Array.isArray(secondArg)) {
        return array.map((x, i) => x / (secondArg[i] ?? 1));
      }
      return array.map((x) => x / secondArg!);

    case "normToMin": {
      const min = Math.min(...array);
      return array.map((x) => x / min);
    }

    case "normToMax": {
      const max = Math.max(...array);
      return array.map((x) => x / max);
    }

    case "normToRange": {
      const min = Math.min(...array);
      const max = Math.max(...array);
      const range = max - min || 1;
      return array.map((x) => (x - min) / range);
    }

    case "normToVal": {
      const val = typeof secondArg === "number" ? secondArg : 1;
      return array.map((x) => x / val);
    }

    case "abs": {
      const I0 = typeof secondArg === "number" ? secondArg : array[0];
      return array.map((x) => -Math.log10(x / I0));
    }

    case "ma": {
      const window = typeof secondArg === "number" ? secondArg : 3;
      const result: number[] = [];
      for (let i = 0; i <= array.length - window; i++) {
        const slice = array.slice(i, i + window);
        const avg = slice.reduce((a, b) => a + b, 0) / window;
        result.push(avg);
      }
      return result;
    }

    default:
      throw new Error(`Unsupported TransformTrace operation: ${operation}`);
  }
}

function MathMIN(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  return Math.min(...values);
}

function MathMAX(values: number[]): number | null {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

export function analyze(json: any) {
  let trace_raw;
  let i;
  const output: any = {}; // Define the output object here
  // output elements are displayes

  // check if json has valid time.

  if (json.time !== undefined) {
    // Check if the key time exists in json
    output.time = json.time; // Add key time and value to output
  }

  // set up some explanatory text

  const light_conditions = ["ambient", "high"];

  // json.v_arrays contains the variable arrays using in the protocol

  const v_arrays = json.v_arrays;

  // --------------------------------------------------
  // --------------------------------------------------
  // displays pirk_intensity stores in v_array[7]

  output.pirk_intensity = v_arrays[7][0]; //pirk_intensities[inc_index];

  // --------------------------------------------------
  // --------------------------------------------------
  //      Extract the autogain values to calculate relative fluo. yield
  //    (assuming measuring intensity = pulse duration * pulse intensity)
  //

  const auto = GetProtocolByLabel("autogain", json, true);
  const autogain_ch1_duration = auto[0].autogain[0][3]; // get mesuring pulse duration.
  const autogain_ch1_intensity = auto[0].autogain[0][4]; // get mesuring pulse intensity (DAC).
  const autogain_ch2_duration = auto[0].autogain[1][3]; // repeat for other channel.
  const autogain_ch2_intensity = auto[0].autogain[1][4];
  const ch1_intensity = -1 * autogain_ch1_duration * autogain_ch1_intensity; // calculate intensity ML,
  const ch2_intensity = -1 * autogain_ch2_duration * autogain_ch2_intensity; // multiply -1 to change DAC logic.
  output.autogain_ch1_duration = autogain_ch1_duration;
  output.autogain_ch1_intensity = autogain_ch1_intensity;

  // --------------------------------------------------
  // --------------------------------------------------
  //          Extract the environmental variables
  //              calculate the SPAD values
  //

  // Retrieve the environmental data protocol labeled "env" from the JSON payload
  const Environmental_traces = GetProtocolByLabel("env", json, true);

  // Round the ambient temperature to 4 decimal places and assign to output
  output.ambient_Temperature = MathROUND(Environmental_traces[0].temperature, 4);

  // Round the relative humidity to 4 decimal places and add to the output
  output.humidity = MathROUND(Environmental_traces[0].humidity, 4);

  // Round the barometric pressure (e.g., in hPa) to 4 decimal places and assign
  output.pressure = MathROUND(Environmental_traces[0].pressure, 4);

  // Round the photosynthetically active radiation (PAR) value to 1 decimal place
  output.PAR = MathROUND(Environmental_traces[0].light_intensity, 1);

  // Compute the square root of PAR to linearize the relationship, then round to 1 decimal place
  output.SQRT_PAR = MathROUND(Math.sqrt(Environmental_traces[0].light_intensity), 1);

  // Capture the leaf surface temperature measured by a contactless sensor (IR thermometer)
  output.leaf_temperature = Environmental_traces[0].contactless_temp;

  // Calculate the differential between leaf and ambient temperature, then round to 2 decimal places
  // Positive values indicate the leaf is warmer than the surrounding air
  output.leaf_temperature_differential = MathROUND(
    Environmental_traces[0].contactless_temp - Environmental_traces[0].temperature,
    2,
  );

  // Record the angle of the leaf relative to a reference plane (e.g., horizontal)
  // Useful for understanding light interception and orientation effects
  output.leaf_angle = Environmental_traces[0].angle;

  // --------------------------------------------------
  //                   SPAD measurement
  // --------------------------------------------------

  // Retrieve the SPAD protocol data labeled "SPAD" from the JSON payload
  const spadData = GetProtocolByLabel("SPAD", json, true);

  // Extract the first SPAD reading from the data array
  // Round the SPAD value to 1 decimal place for consistency in reporting
  output.SPAD = MathROUND(spadData[0].spad[0], 1);

  // --------------------------------------------------
  //          Test if SPAD and PAR values are reasonable
  //          Issue warnings if out of expected range
  // --------------------------------------------------

  // SPAD physiological range check (typical 10 to 70)
  // If the SPAD reading is below 10 or above 70, trigger a danger warning
  if (output.SPAD < 10 || output.SPAD > 70) {
    danger("SPAD out of range", output);
  }

  // PAR sensor range check (sensor limits usually 0 to 2500 µmol/m²/s)
  // Values outside this range may indicate a sensor fault or abnormal lighting conditions
  if (output.PAR < 0 || output.PAR > 2500) {
    danger("PAR out of range", output);
  }

  // --------------------------------------------------
  // --------------------------------------------------
  // Calculate time for the measurement after leaf gets clamped
  //
  // --------------------------------------------------

  // Retrieve protocol entries for measurement start and end times
  const s_time = GetProtocolByLabel("start_time", json, true);
  const e_time = GetProtocolByLabel("end_time", json, true);

  // Extract the actual timestamp values (in milliseconds) from the protocol arrays
  // The start time is taken from the first entry's e_time field
  const start_time = s_time[0].e_time[1];
  // The end time is taken from the last entry in the end time protocol
  const end_time = e_time[e_time.length - 1].e_time[1];

  // Calculate measurement duration in seconds by subtracting timestamps and converting ms to s
  output.measurement_duration_sec = (end_time - start_time) / 1000;

  // --------------------------------------------------
  //          Test if measurement duration is within expected range
  //          Issue warning if out of expected bounds
  // --------------------------------------------------

  // Typical clamp measurement times range from 20 to 50 seconds
  // If the duration is shorter or longer, it may indicate clamp mispositioning or sensor issues
  if (output.measurement_duration_sec < 20 || output.measurement_duration_sec > 50) {
    danger("Measurement time long: check clamp open/close positions", output);
  }

  // --------------------------------------------------
  // --------------------------------------------------
  //          Extract the PIRK trace

  let traces = GetProtocolByLabel("PIRK", json, true);

  // returns one or more JSON object for the data where label == 'PIRK'
  // inputs are: ( the label string, the json, true = always return a list, false = if only one element, return that, otherwise return list)

  // find the number of PIRK pulses stored in v_arrays
  const PIRK_pulses = v_arrays[0];

  // display the value
  output.PIRK_pulses = PIRK_pulses.join();
  const PIRK_baseline = PIRK_pulses[0];

  const PIRK_act = PIRK_pulses[0] + PIRK_pulses[1];

  for (i = 0; i < traces.length; i++) {
    trace_raw = traces[i].data_raw; // Select repeat

    const transmittance530_PIRK = ArrayNth(trace_raw, 1, 0);

    // convert transmttance to absorbance

    const PIRK_abs = TransformTrace(
      "abs",
      transmittance530_PIRK,
      // @ts-expect-error
      MathMEAN(transmittance530_PIRK.slice(1, 10)),
    );
    output["PIRK_" + light_conditions[i]] = PIRK_abs;
    output["PIRK_amp_" + light_conditions[i]] = MathROUND(1000 * PIRK_abs[PIRK_act], 3);
  }

  // --------------------------------------------------

  // --------------------------------------------------
  //          Extract the PAM and ABS traces
  // calculate the rel. fluo. yield according autogain values
  //

  // the following identify the indexes to the various segments of the PAM trace
  // as stored in v_arrays

  const pam_abs_idx1 = v_arrays[1][0];
  const pam_abs_idx2 = v_arrays[1][1];
  const pam_abs_idx3 = v_arrays[1][2];
  const pam_abs_idx4 = v_arrays[1][3];
  const pam_abs_idx5 = v_arrays[1][4];
  const pam_abs_idx6 = v_arrays[1][5];
  const pam_abs_idx7 = v_arrays[1][6];

  // extract Fs location between 10% before MPF1 and MPF1 start
  // @ts-ignore
  const pam_abs_blk2_s = pam_abs_idx1 - parseInt(pam_abs_idx1 / 10); // index of MPF1-10%_block1
  const pam_abs_blk2_e = pam_abs_idx1; // index  MPF1
  // The first 4 blocks represent the 4 steps of the multi-phase flash (MPF)
  // those block are taken as the average from 10% before the last point to the last point
  // MPF1 == pam_abs_blk3,pam_abs_blk4, pam_abs_blk5, pam_abs_blk6
  // @ts-ignore
  const pam_abs_blk3_s = pam_abs_blk2_e + parseInt(pam_abs_idx2) - parseInt(pam_abs_idx2 / 10); // MPF1 step 1
  const pam_abs_blk3_e = pam_abs_blk2_e + parseInt(pam_abs_idx2);
  // @ts-ignore
  const pam_abs_blk4_s = pam_abs_blk3_e + parseInt(pam_abs_idx3) - parseInt(pam_abs_idx3 / 10); // MPF1 step 2
  const pam_abs_blk4_e = pam_abs_blk3_e + parseInt(pam_abs_idx3);
  // @ts-ignore
  const pam_abs_blk5_s = pam_abs_blk4_e + parseInt(pam_abs_idx4) - parseInt(pam_abs_idx4 / 10); // MPF1 step 3
  const pam_abs_blk5_e = pam_abs_blk4_e + parseInt(pam_abs_idx4);
  // @ts-ignore
  const pam_abs_blk6_s = pam_abs_blk5_e + parseInt(pam_abs_idx5) - parseInt(pam_abs_idx5 / 10); // MPF1 step 4
  const pam_abs_blk6_e = pam_abs_blk5_e + parseInt(pam_abs_idx5);
  // --------------------------------------------------

  traces = GetProtocolByLabel("PAM-ABS", json, true);

  for (i = 0; i < traces.length; i++) {
    trace_raw = traces[i].data_raw; // Select repeat
    const fluorescence = ArrayNth(trace_raw, 2, 0); // Get fluorescence curve, iterate and pick
    // let fluorescence = TransformTrace( "divide", fluorescence,ch1_intensity);
    const transmittance820 = ArrayNth(trace_raw, 2, 1); // Get absorbance curve, iterate and pick
    const absorbance820 = TransformTrace(
      "abs",
      transmittance820,
      // @ts-ignore
      MathMEAN(transmittance820.slice(1, 10)),
    );
    output["fluo_" + light_conditions[i]] = fluorescence;
    output["abs820_" + light_conditions[i]] = absorbance820;

    // @ts-ignore
    const fs = MathROUND(MathMIN(fluorescence.slice(pam_abs_blk2_s, pam_abs_blk2_e)), 5);

    // @ts-ignore
    const mpf1 = MathROUND(MathMEAN(fluorescence.slice(pam_abs_blk3_s, pam_abs_blk3_e)), 5);
    // @ts-ignore
    const mpf2 = MathROUND(MathMEAN(fluorescence.slice(pam_abs_blk4_s, pam_abs_blk4_e)), 5);
    // @ts-ignore
    const mpf3 = MathROUND(MathMEAN(fluorescence.slice(pam_abs_blk5_s, pam_abs_blk5_e)), 5);
    // @ts-ignore
    const mpf4 = MathROUND(MathMEAN(fluorescence.slice(pam_abs_blk6_s, pam_abs_blk6_e)), 5);
    // @ts-ignore
    const fm = MathROUND(MathMAX([mpf1, mpf2, mpf3, mpf4]), 5);
    const phi2 = MathROUND((fm - fs) / fm, 5); // MPF calculation NOT implemented

    output["used_PAR_" + light_conditions[i]] = traces[i].pi[1];
    output["phi2_" + light_conditions[i]] = MathROUND(phi2, 4);
    output["LEF_" + light_conditions[i]] = MathROUND(0.4 * phi2 * traces[i].pi[1], 2);

    if (phi2 < 0) {
      danger("Phi2" + light_conditions[i] + " below 0", output);
    }
    if (phi2 > 1) {
      danger("Phi2" + light_conditions[i] + " above 1", output);
    }
  }

  output.LEF_light_potential = MathROUND(
    output["LEF_" + light_conditions[1]] - output["LEF_" + light_conditions[0]],
    2,
  );

  traces = GetProtocolByLabel("PAM-ABS-FR", json, true);

  for (i = 0; i < traces.length; i++) {
    trace_raw = traces[i].data_raw; // Select repeat
    const fluorescence = ArrayNth(trace_raw, 2, 0); // Get fluorescence curve, iterate and pick
    //let fluorescence = TransformTrace( "divide", fluorescence,ch1_intensity);
    const transmittance820 = ArrayNth(trace_raw, 2, 1); // Get absorbance curve, iterate and pick
    const absorbance820 = TransformTrace("abs", transmittance820);
    output["fluor_FR_" + i] = fluorescence;
    output["A820_FR_" + i] = absorbance820;
    const mean_transmittance820 = MathMEAN(transmittance820.slice(0, 20));
    // @ts-ignore
    if (mean_transmittance820 < 8000 || mean_transmittance820 > 65000) {
      danger("820nm out of range", output);
    }
  }

  // --------------------------------------------------
  // --------------------------------------------------
  // send all the device settings to output

  output.settings = JSON.stringify(GetProtocolByLabel("print_memory", json)[0]);

  // --------------------------------------------------
  // --------------------------------------------------
  // Create dialog on Multispeq with important values

  output.order = [
    "leaf_angle",
    "SPAD",
    "PAR",
    "phi2_ambient",
    "LEF_ambient",
    "phi2_high",
    "LEF_high",
    "LEF_light_potential",
    "SQRT_PAR",
    "ambient_Temperature",
    "leaf_temperature",
    "leaf_temperature_differential",
    "humidity",
    "pressure",
  ];

  return output;
}

// -------------------------------------------------
// -------------------------------------------------
// 				Here start the protocol code
// -------------------------------------------------
// -------------------------------------------------

// A protocol is defined in two nested loops, the set repeat and the protocol repeat.
// you can see the set as the main protocol, and the protocol repeat as sub-protocol loop of the set.
// The first part of the protocol usually initialize some arrays, and helper function.

export const protocol = [
  {
    // "Share":1 this tells the old PhotosynQ platform to let people share the protocol. This was a workaround to deal with the problem that the platform downloaded the entire set of thousands of of protocols to the App.

    share: 1,

    // "v_arrays" is a list of list of variables that can be used in the maing part of the code. they are zero-indexes and can be accessed with various indexing pointers, as describved int he following,.

    v_arrays: [
      [100, 2, 100, 100, 100], // 0: pulses, 5 groups of 100,2,100,100,100 (every group has different pulse rate and/or different intensity (e.g. background light))

      [30, 50, 50, 50, 50, 100],

      [6000, 5000, 4000, 3000],

      ["p_light", 2500],

      [2000, 10000],

      [2000, 2000],

      [40, 320, 320, 320, 2, 320, 200, 200, 200, 200],

      [2000, 2000, 2000],
    ],

    set_repeats: "#l3",

    // The protocol contains a set of sub-protocols.
    // set_repeats sets the number of repeats for tthe entire set

    //  "#l3" tells the find the length of the 3rd array in v_arrays
    //  and set the number of repeats of the entire set of sub-protocols

    // A list containing the set of sub-protocols

    _protocol_set_:
      // In general, it is a good idea to have a label for each
      // sub-protocol so that the macro can find the results using
      // the GetProtocolByLabel command.
      // Note that if the subprotocol is repeated, the GetProtocolByLabel
      // command will return a list with all repeats.
      [
        { label: "start_time", e_time: 0 },

        // start time sets reports the innitial time
        // e_time reports the elapsed time.
        // label is important because it allows the macro to find the data from each
        // sub-protocols

        { label: "capture_PAR", par_led_start_on_open: 2, averages: 1, do_once: 1 },

        // "par_led_start_on_open": 2 tells instrument to wait until the clamp is opened. While waiting, continuously meaured PAR and reproduce the same value in the clamp using LED #2

        // "do_once":1 tells to perform this sub_protocol only on the first repeat of the set_repeats. (Note this is not zero indexed)

        // "averages": 1, repeat and average only one time (this is the defaul value for "averages" so it is not required.

        { par_led_start_on_close: 2, do_once: 1 },

        // "par_led_start_on_close": 2 tells instrument to wait until the clamp is closed. While waiting, continuously meaured PAR and reproduce the same value in the clamp using LED #2

        {
          label: "env",
          environmental: [
            ["light_intensity"],
            ["temperature_humidity_pressure"],
            ["temperature_humidity_pressure2"],
            ["contactless_temp"],
            ["compass_and_angle"],
          ],
          do_once: 1,
        },

        // perform a series of environmental sensing measurements

        // [ "light_intensity" ], PAR or

        // [ "temperature_humidity_pressure" ], The first THP sensor

        // [ "temperature_humidity_pressure2" ], The second TMP sensor

        // [ "contactless_temp" ],  Leaf tmperature

        // [ "compass_and_angle" ]  compass and angle

        {
          label: "autogain",
          autogain: [
            [0, 3, 1, 10, 1200],
            [1, 10, 1, 20, 50000],
            [2, 1, 3, 20, 50000],
          ],
          do_once: 1,
        },

        // This sub-protocol performs three autogain settings
        //
        // "autogain" accepts a list of lists, each sub-list setting up an autogain
        // process:
        // [auto_gain_index, led#, detector#, pulse duraction, target ADC value]

        // auto_gain_index is used to insert autogain values infor use in a sub-protocol

        // led#: which measuring led to use
        // detector# to use
        // pulse duration in microseconds
        // attempt to set the amplitude of the led current to give an ADC signal of this amplitude.

        // example:

        // [ 0, 3, 1, 10, 1200 ]
        // auto_gain_index = 0
        // led#3 (orange)
        // detector #1 (top IR)
        //

        // In the following protocol are defined 3 different sub-protocol: PIRKS, PAM-ABS and PAM-ABS-FR
        // A sub-protocol is composed of:
        // 							- a measuring ligh, a pulsed light that will probe the photosynthetic state of the leaf.
        //							- an actinic light (or background light), a light that will be set to a fix intensity and induce photosynthesis.
        // A sub-protocol is organized as a serie of measuring pulses with usually a constant intensity and duration,
        // but often with a variable distance between them (defining the sampling speed) and changes in the background light intensity.
        // // The pulses can be detected either by:
        // 								- a detector with a long-pass filter that detect in the infrared,
        // 								- or a dector detecting in the visible range.

        // We are going to take for example the PIRK sub-protocol that is defined here below with label "PIRK"
        // The sub-protocol start with a period of pre-illumination, which is a period in which a background light is applied and where NO pulses for measurments are applied,
        // In this example the PIRK sub-protocol is composed of 5 pulses "block".
        // Each pulse block tells the instrument:
        // - which LED to use for the pulsed light ,
        // - how many pulses are in the block
        // - what intensity and duration is the measuring pulse,
        // - the distance between measuring pulses (setting sampling speed)
        // - which detector to use to measure the pulse
        // - which LED to use for the background light (actinic light)
        // - to which intensity the backround light is set
        // For example, the command "pulses": [ "@n0:0", "@n0:1", "@n0:2", "@n0:3", "@n0:4" ] tells the instrument that there are 5 group of pulses, with an ammount defined in the
        // v_array 0, at index number 0.
        // You might notice that the v_array is sometimes called as "@n" or "@s" or "@p", these decorators indicate which indexing to use.
        // taking an example with v_array = [ [0,1,2,3], [4,5,6] ]
        // In the case of @n, the indexing is "rigid" and do not change. For example "@n1:0" will refer to the v_array[1][0] which will return: 4.
        // In the case of @p, the indexing change according the protocol repeat index.
        // For example "@p0" will refer to the v_array[0][#protocol_repeat] and at the first time the protocol is repeated it will call v_array[0][0] and return 0
        // In the the case @s, the indexing refers to the "set_repeat" which refers to how many time we have looped through the set (main protocol).

        // Another type of indexing is "a_bX", which refers to the intensity values stored in the autogain number X to achieve the desirable brightness
        // and "a_bX", which refers to the duration of stored in the autogain number X.

        {
          label: "PIRK",
          // pre-illumination( [ LED#, intensity, duration ms)
          pre_illumination: [2, "@s3", "@s4"],
          // Pulse group identifiers: 5 blocks referencing v_array0 at indices 0–4
          pulses: ["@n0:0", "@n0:1", "@n0:2", "@n0:3", "@n0:4"],
          // LED channel(s) for pulsed measuring light (here LED 1 = green)
          pulsed_lights: [[1], [1], [1], [1], [1]],
          // Interval between pulses (µs) sets sampling rate
          pulse_distance: [1000, 1000, 1000, 1000, 1000],
          // Pulse brightness via autogain2
          pulsed_lights_brightness: [["a_b2"], ["a_b2"], ["a_b2"], ["a_b2"], ["a_b2"]],
          // Pulse duration via autogain2
          pulse_length: [["a_d2"], ["a_d2"], ["a_d2"], ["a_d2"], ["a_d2"]],
          // Use visible-range detector 3 for each block
          detectors: [[3], [3], [3], [3], [3]],
          // Background LEDs during pulses: channels 2 (red) and 4 (blue)
          nonpulsed_lights: [
            [2, 4],
            [2, 4],
            [2, 4],
            [2, 4],
            [2, 4],
          ],
          // Background brightness: dynamic via set-repeat and autogain
          nonpulsed_lights_brightness: [
            ["@s3", 0],
            ["@s3", "@s7"],
            ["@s3", 0],
            [0, 0],
            ["@s3", 0],
          ],
          // Number of signal averages per block
          averages: 1,
          // How many times to repeat the entire PIRK series
          protocol_repeats: 1,
        },

        // This sub-protocol is a bit more complex, it will measure two spectroscopic signal almost simultaneously.
        // To do this we define two measuring lights and two detectors.
        // The instrument will pulse first with one light and detect with one detector, and after the "pulse_distance" time
        // pulse with the other light and detect with the other (or same) dector.
        // Note that therefore the total elapsed time will double.
        // For example
        {
          label: "PAM-ABS",
          pre_illumination: [2, "@s3", "@s5"],
          // Six pulse blocks referencing v_array1
          pulses: ["@n1:0", "@n1:1", "@n1:2", "@n1:3", "@n1:4", "@n1:5"],
          // Background LED2 during all pulses
          nonpulsed_lights: [[2], [2], [2], [2], [2], [2]],
          // Background brightness: mix of static and dynamic values
          nonpulsed_lights_brightness: [
            ["@s3"],
            ["@n2:0"],
            ["@n2:1"],
            ["@n2:2"],
            ["@n2:3"],
            ["@s3"],
          ],
          // Constant 1ms spacing between pulses
          pulse_distance: [1000, 1000, 1000, 1000, 1000, 1000],
          // Dual-channel pulsed brightness from autogain0 and autogain1
          pulsed_lights_brightness: [
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
          ],
          // Dual-channel pulse durations
          pulse_length: [
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
          ],
          // Use detector channels 1 & 1 (two measurements per pulse)
          detectors: [
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
          ],
          // LEDs 3 (amber) & 10 (far-red) for pulses
          pulsed_lights: [
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
          ],
          averages: 1,
          protocol_repeats: 1,
        },
        {
          label: "PAM-ABS-FR",
          // Ten pulse blocks referencing v_array6
          pulses: [
            "@n6:0",
            "@n6:1",
            "@n6:2",
            "@n6:3",
            "@n6:4",
            "@n6:5",
            "@n6:6",
            "@n6:7",
            "@n6:8",
            "@n6:9",
          ],
          // Background LEDs 2 (red) & 9 (far-red) during each block
          nonpulsed_lights: [
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
            [2, 9],
          ],
          nonpulsed_lights_brightness: [
            ["@s3", 0],
            [0, 200],
            [0, 400],
            [0, 800],
            [2500, 800],
            [0, 200],
            [0, 1600],
            [0, 0],
            [5000, 500],
            [0, 0],
          ],
          pulse_distance: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
          // Dual-channel pulsed brightness same for every block
          pulsed_lights_brightness: [
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
            ["a_b0", "a_b1"],
          ],
          // Dual-channel pulse duration same for each block
          pulse_length: [
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
            ["a_d0", "a_d1"],
          ],
          // Use detectors 1 & 1
          detectors: [
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
            [1, 1],
          ],
          pulsed_lights: [
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
            [3, 10],
          ],
          averages: 1,
          protocol_repeats: 1,
          do_once: -1,
        },
        // Measure SPAD
        { label: "SPAD", spad: [1], averages: 1, dw: [14, 0], do_once: -1 },
        // Measure elapsed time
        { label: "end_time", e_time: 0 },
        // Notify end measurements through LED
        { label: "measuring_light", hello: [1] },
        // Print the calibration values stored in memory
        { label: "print_memory", recall: ["settings"] },
      ],
  },
];

export const label = "UNZA PIRK DIRK LightPotential14";

export { example } from "./upd14-example";
