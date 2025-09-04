import { z } from "zod";
import type { ZodIssue } from "zod";

// Hardware pin numbers for MultispeQ devices (expanded based on real data)
const VALID_PINS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
] as const;

// Light intensity range (0-4095 or -1 for ambient)
const LightIntensitySchema = z.number().int().min(-1).max(4095);

// Pin number validation
const PinNumberSchema = z
  .number()
  .int()
  .refine((val) => VALID_PINS.includes(val as (typeof VALID_PINS)[number]), {
    message: "Invalid pin number",
  });

// Variable references used in protocols (expanded based on real data)
const VariableReferenceSchema = z
  .string()
  .regex(
    /^(a_[a-z0-9_]+|light_intensity|auto_bright[0-9]*|auto_duration[0-9]*|@s[0-9]+|p_light|@[a-z][0-9]+|@[a-z][0-9]+:[0-9]+)$/,
  );

// Environmental sensor types - more flexible approach
const KNOWN_SENSORS = [
  "light_intensity",
  "light_intensity_raw",
  "previous_light_intensity",
  "temperature",
  "relative_humidity",
  "co2",
  "temperature_humidity_pressure",
  "temperature_humidity_pressure2",
  "contactless_temp",
  "compass_and_angle",
  "thickness",
  "analog_read",
] as const;

const EnvironmentalSensorSchema = z
  .array(
    z.union([
      z
        .string()
        .refine(
          (s) => KNOWN_SENSORS.includes(s as (typeof KNOWN_SENSORS)[number]),
          "Unknown sensor type",
        ),
      z.number().int(),
    ]),
  )
  .min(1); // At least sensor name, optional parameters

// Core protocol schema with all possible fields
export const ProtocolSetSchema = z
  .object({
    // Label field (required only for multi-protocol sets, optional for single protocols)
    label: z.string().optional(),

    // Basic control fields
    averages: z.number().int().positive().optional(),
    averages_delay: z.number().int().nonnegative().optional(),
    averages_delay_ms: z.number().int().nonnegative().optional(),
    protocols: z.number().int().positive().optional(),
    protocols_delay: z.number().int().nonnegative().optional(),
    measurements: z.number().int().positive().optional(),
    measurements_delay: z.number().int().nonnegative().optional(),

    // Light pulse configuration
    pulses: z.array(z.union([z.number().int().positive(), VariableReferenceSchema])).optional(),
    pulsesize: z.number().int().positive().optional(),
    pulsedistance: z.number().int().positive().optional(),
    pulse_distance: z.array(z.number().int().positive()).optional(),
    pulse_length: z
      .array(z.array(z.union([z.number().int().nonnegative(), VariableReferenceSchema])))
      .optional(), // Allow 0

    // Light source hardware configuration
    act_background_light: PinNumberSchema.optional(),
    act1_lights: z.array(PinNumberSchema).optional(),
    act2_lights: z.array(PinNumberSchema).optional(),
    pulsed_lights: z.array(z.array(PinNumberSchema)).optional(),
    nonpulsed_lights: z.array(z.array(PinNumberSchema)).optional(),
    meas_lights: z.array(z.array(PinNumberSchema)).optional(),

    // Light intensity configuration
    act_intensities: z.array(LightIntensitySchema).optional(),
    cal_intensities: z.array(LightIntensitySchema).optional(),
    meas_intensities: z.array(LightIntensitySchema).optional(),
    pulsed_lights_brightness: z
      .array(z.array(z.union([z.number().int().nonnegative(), VariableReferenceSchema])))
      .optional(), // Allow 0
    nonpulsed_lights_brightness: z
      .array(z.array(z.union([z.number().int().nonnegative(), VariableReferenceSchema])))
      .optional(),

    // Detector configuration
    detectors: z.array(z.array(PinNumberSchema)).optional(),

    // Environmental sensors
    environmental: z.array(EnvironmentalSensorSchema).optional(),

    // Special measurements
    spad: z.array(z.union([z.number().int().positive(), z.array(z.number().int())])).optional(), // Can be array of arrays as seen in report
    get_blank_cal: z.array(PinNumberSchema).optional(),
    get_ir_baseline: z.array(PinNumberSchema).optional(),
    get_offset: z.number().int().optional(),

    // Advanced configuration
    autogain: z
      .array(
        z.tuple([
          PinNumberSchema, // light_pin
          PinNumberSchema, // detector_pin
          z.number().int().min(1).max(4), // gain_level
          z.number().int().positive(), // intensity
          z.number().int().positive(), // timeout
        ]),
      )
      .optional(),

    pre_illumination: z
      .array(
        z.union([
          z.number().int(),
          z.string().regex(/^@s[0-9]+$/), // Variable reference like "@s2",
          z.array(z.number().int()),
          z.array(z.string().regex(/^@s[0-9]+$/)),
        ]),
      )
      .optional(),

    // Device control
    tcs_to_act: z.number().int().min(0).max(100).optional(),
    par_led_start_on_open: z.number().int().optional(),
    par_led_start_on_close: z.number().int().optional(),
    energy_save_timeout: z.number().int().positive().optional(),
    energy_min_wake_time: z.number().int().positive().optional(),
    do_once: z.number().int().optional(), // Can be negative
    dw: z.array(z.union([z.number().int(), z.string()])).optional(), // Can contain strings like "@i4"

    // Additional fields discovered from CSV data
    protocol_repeats: z.union([z.number().int(), z.string()]).optional(), // Can be number or string like "@n0:0"
    recall: z.array(z.string()).optional(), // Array of calibration strings
    indicator: z.array(z.number().int()).optional(), // LED indicator values
    gs_air: z.number().int().optional(), // Gas sensor air
    v_arrays: z.array(z.array(z.union([z.number(), z.string()]))).optional(), // Complex mixed arrays
    protocols_pre_delay: z.string().optional(), // String references like "@n5:1"
    set_light_intensity: z.union([z.number().int(), z.string()]).optional(), // Can be number or string like "@s2"
    pulses_delay: z.array(z.number().int()).optional(), // Delay between pulses
    set_air_flow: z.number().int().optional(), // Air flow control
    bleed_correction: z.number().int().optional(), // Correction factor
    set_repeats: z.union([z.number().int(), z.string()]).optional(), // Repeat count, can be string like "#l2"
    protocol_averages: z.number().int().optional(), // Protocol-level averages
    check_battery: z.number().int().optional(), // Battery check flag
    led_persist: z.number().int().optional(), // LED persistence
    open_close_start: z.number().int().optional(), // Open/close start position
    indicate_red: z.number().int().optional(), // Red indicator intensity
    indicate_green: z.number().int().optional(), // Green indicator intensity
    share: z.number().int().optional(), // Share flag
    set_led_delay: z.array(z.array(z.number().int())).optional(), // LED delay configuration
    message: z.array(z.array(z.string())).optional(), // User messages/prompts
    e_time: z.number().int().optional(),
    hello: z.array(z.number().int()).optional(),
  })
  .strict();

// Schema for protocols within a multi-protocol set (requires label)
const ProtocolSetWithLabelSchema = ProtocolSetSchema.extend({
  label: z.string(), // Required for multi-protocol sets
}).strict();

// Single and multi-protocol set schema
export const ProtocolJsonSchema = z.array(
  ProtocolSetSchema.extend({
    _protocol_set_: z.array(ProtocolSetWithLabelSchema).min(1).optional(),
  }).strict(),
);

export type ProtocolSet = z.infer<typeof ProtocolSetSchema>;
export type ProtocolJson = z.infer<typeof ProtocolJsonSchema>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: z.ZodIssue[];
}

export function validateProtocolJson(json: unknown): ValidationResult<ProtocolJson> {
  try {
    const validated = ProtocolJsonSchema.parse(json);
    return {
      success: true,
      data: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues,
      };
    }
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: [
          {
            code: z.ZodIssueCode.custom,
            message: `Invalid JSON syntax: ${error.message}`,
            path: [],
          },
        ],
      };
    }
    throw error;
  }
}

// Utility functions for protocol analysis
export function isMultiProtocolSet(protocol: ProtocolJson[0]) {
  return "_protocol_set_" in protocol;
}

export function extractProtocolSets(protocolJson: ProtocolJson): ProtocolSet[] {
  const sets: ProtocolSet[] = [];

  for (const protocol of protocolJson) {
    if ("_protocol_set_" in protocol && protocol._protocol_set_) {
      sets.push(...protocol._protocol_set_);
    } else {
      sets.push(protocol);
    }
  }

  return sets;
}

export function getEnvironmentalSensors(protocolSet: ProtocolSet) {
  if (!protocolSet.environmental) return [];

  return protocolSet.environmental.map((sensor) => sensor[0]);
}

export function getLightPins(protocolSet: ProtocolSet): number[] {
  const pins = new Set<number>();

  // Collect all light-related pins
  if (protocolSet.act_background_light !== undefined) {
    pins.add(protocolSet.act_background_light);
  }

  protocolSet.act1_lights?.forEach((pin) => pins.add(pin));
  protocolSet.act2_lights?.forEach((pin) => pins.add(pin));
  protocolSet.pulsed_lights?.forEach((lightArray) => lightArray.forEach((pin) => pins.add(pin)));
  protocolSet.nonpulsed_lights?.forEach((lightArray) => lightArray.forEach((pin) => pins.add(pin)));
  protocolSet.meas_lights?.forEach((lightArray) => lightArray.forEach((pin) => pins.add(pin)));

  return Array.from(pins)
    .filter((pin) => pin > 0)
    .sort();
}

export function getDetectorPins(protocolSet: ProtocolSet): number[] {
  if (!protocolSet.detectors) return [];

  const pins = new Set<number>();
  protocolSet.detectors.forEach((detectorArray) => detectorArray.forEach((pin) => pins.add(pin)));

  return Array.from(pins).sort();
}

interface PathItem {
  item: string;
  arrayIndex?: number;
}

export function getPathItem(path: (string | number)[]): PathItem | undefined {
  const item = path.shift();
  if (item === undefined) {
    return undefined;
  }
  if (typeof item === "string") {
    return { item };
  }
  const arrayIndex = item;
  const nextItem = path.shift();
  if (typeof nextItem === "string") {
    return { item: nextItem, arrayIndex };
  }
  return undefined;
}

export function getErrorMessage(e: ZodIssue) {
  if (e.path.length == 0) return e.message;
  switch (e.code) {
    case "unrecognized_keys":
      return `Item: '${e.keys[0]}': Unrecognized"`;
    default: {
      for (let i = e.path.length - 1; i >= 0; i--) {
        const pathEnd = e.path[i];
        if (typeof pathEnd === "string") {
          return `Item '${pathEnd}': ${e.message}`;
        }
      }
      return "-";
    }
  }
}

export function findProtocolErrorLine(text: string, e: ZodIssue) {
  // Try to find the line number of the error path in the JSON
  // This is a best-effort guess, as Zod does not provide line numbers
  const message = getErrorMessage(e);
  let line = 1;
  if (e.path.length == 0) return { line, message };
  const codeLines = text.split("\n");
  const containsProtocolSet = e.path.includes("_protocol_set_");
  const missingItem = e.message === "Required";

  if (containsProtocolSet) {
    let pathItem = getPathItem(e.path);
    let protocolSetArrayFound = false;
    for (const codeLine of codeLines) {
      if (codeLine.includes(`"_protocol_set_"`)) {
        protocolSetArrayFound = true;
        pathItem = getPathItem(e.path);
      }
      if (protocolSetArrayFound) {
        if (codeLine.endsWith("}") || codeLine.endsWith("},")) {
          if (pathItem?.arrayIndex == 0 && missingItem) {
            return { line, message };
          }
          if (pathItem?.arrayIndex && pathItem.arrayIndex > 0) {
            pathItem.arrayIndex--;
            line++;
            continue;
          }
        }
        if (pathItem?.arrayIndex == 0 && !missingItem && codeLine.includes(`"${pathItem.item}"`)) {
          return { line, message };
        }
      }
      line++;
    }
  } else {
    const pathItem = getPathItem(e.path);
    for (const codeLine of codeLines) {
      if (pathItem === undefined) return { line, message };
      if (codeLine.includes(`"${pathItem.item}"`)) {
        return { line, message };
      }
      line++;
    }
  }
  return { line, message };
}
