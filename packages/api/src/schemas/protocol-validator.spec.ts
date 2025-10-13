import { describe, it, expect } from "vitest";

import {
  validateProtocolJson,
  isMultiProtocolSet,
  extractProtocolSets,
  getEnvironmentalSensors,
  getLightPins,
  getDetectorPins,
  findProtocolErrorLine,
} from "./protocol-validator";
import type { ProtocolSet } from "./protocol-validator";

describe("Comprehensive Protocol JSON Validator", () => {
  describe("Basic Protocol Validation", () => {
    it("should validate minimal protocol with only label", () => {
      const minimal = [{ label: "test_protocol" }];
      const result = validateProtocolJson(minimal);

      expect(result.success).toBe(true);
      expect(result.data?.[0]).toHaveProperty("label", "test_protocol");
    });

    it("should accept protocols without label (single protocols)", () => {
      const missingLabel = [{ averages: 1 }];
      const result = validateProtocolJson(missingLabel);

      expect(result.success).toBe(true); // Single protocols don't require labels
    });

    it("should validate all basic control fields", () => {
      const basicProtocol = [
        {
          label: "comprehensive_test",
          averages: 5,
          averages_delay: 100,
          averages_delay_ms: 250,
          protocols: 2,
          protocols_delay: 10,
          measurements: 60,
          measurements_delay: 5,
        },
      ];

      const result = validateProtocolJson(basicProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.averages).toBe(5);
      expect(protocol.measurements).toBe(60);
    });
  });

  describe("Light Configuration Validation", () => {
    it("should validate pulse configuration", () => {
      const pulseProtocol = [
        {
          label: "pulse_test",
          pulses: [150, 20, 50, 100],
          pulsesize: 10,
          pulsedistance: 1500,
          pulse_distance: [1000, 1500, 2000],
          pulse_length: [["a_d2"], [30, "a_d3"], ["a_b1"]],
        },
      ];

      const result = validateProtocolJson(pulseProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.pulses).toEqual([150, 20, 50, 100]);
      expect(protocol.pulse_length).toHaveLength(3);
    });

    it("should validate light source hardware pins", () => {
      const lightProtocol = [
        {
          label: "light_test",
          act_background_light: 20,
          act1_lights: [20, 20, 0, 15],
          act2_lights: [0, 15, 16],
          pulsed_lights: [[1], [2], [3, 8]],
          nonpulsed_lights: [[2], [0], [12]],
          meas_lights: [[12, 14], [15]],
        },
      ];

      const result = validateProtocolJson(lightProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.act_background_light).toBe(20);
      expect(protocol.pulsed_lights?.[2]).toEqual([3, 8]);
    });

    it("should reject invalid pin numbers", () => {
      const invalidPin = [
        {
          label: "invalid_pin_test",
          act1_lights: [99], // Invalid pin number
        },
      ];

      const result = validateProtocolJson(invalidPin);

      expect(result.success).toBe(false);
      expect(result.error?.[0].message).toContain("Invalid pin number");
    });

    it("should validate light intensities including ambient (-1)", () => {
      const intensityProtocol = [
        {
          label: "intensity_test",
          act_intensities: [-1, 0, 125, 750, 4095],
          cal_intensities: [4095, 0, 2000],
          meas_intensities: [2465, 3000, 4000],
          pulsed_lights_brightness: [["a_b2"], [400, "auto_bright3"]],
          nonpulsed_lights_brightness: [["light_intensity"], [8000], [0]],
        },
      ];

      const result = validateProtocolJson(intensityProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.act_intensities).toContain(-1); // Ambient light
      expect(protocol.act_intensities).toContain(4095); // Max intensity
    });

    it("should reject out-of-range light intensities", () => {
      const invalidIntensity = JSON.stringify([
        {
          label: "invalid_intensity",
          act_intensities: [5000], // Above max 4095
        },
      ]);

      const result = validateProtocolJson(invalidIntensity);

      expect(result.success).toBe(false);
    });
  });

  describe("Environmental Sensor Validation", () => {
    it("should validate all environmental sensor types", () => {
      const envProtocol = [
        {
          label: "environmental_test",
          environmental: [
            ["light_intensity"],
            ["light_intensity", 0],
            ["temperature", 0],
            ["relative_humidity", 0],
            ["co2", 0],
            ["temperature_humidity_pressure"],
            ["temperature_humidity_pressure2"],
            ["contactless_temp"],
            ["compass_and_angle"],
            ["thickness"],
            ["analog_read", 5, 40],
            ["light_intensity_raw"],
            ["previous_light_intensity"],
          ],
        },
      ];

      const result = validateProtocolJson(envProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.environmental).toHaveLength(13);
      expect(protocol.environmental?.[10]).toEqual(["analog_read", 5, 40]);
    });

    it("should reject invalid environmental sensor configurations", () => {
      const invalidEnv = [
        {
          label: "invalid_env",
          environmental: [["invalid_sensor_type"]],
        },
      ];

      const result = validateProtocolJson(invalidEnv);

      expect(result.success).toBe(false);
    });
  });

  describe("Advanced Configuration Validation", () => {
    it("should validate autogain configuration", () => {
      const autogainProtocol = [
        {
          label: "autogain_test",
          autogain: [
            [2, 1, 3, 12, 50000],
            [3, 8, 1, 80, 50000],
            [1, 34, 4, 100, 60000],
          ],
        },
      ];

      const result = validateProtocolJson(autogainProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.autogain).toHaveLength(3);
      expect(protocol.autogain?.[0]).toEqual([2, 1, 3, 12, 50000]);
    });

    it("should validate pre-illumination settings", () => {
      const preIllumProtocol = [
        {
          label: "pre_illum_test",
          pre_illumination: [2, "@s2", 300],
        },
      ];

      const result = validateProtocolJson(preIllumProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.pre_illumination).toEqual([2, "@s2", 300]);
    });

    it("should validate device control fields", () => {
      const deviceProtocol = [
        {
          label: "device_test",
          tcs_to_act: 85,
          par_led_start_on_open: 2,
          par_led_start_on_close: 1,
          energy_save_timeout: 300000,
          energy_min_wake_time: 7000,
          do_once: -1,
          dw: [14, 0],
        },
      ];

      const result = validateProtocolJson(deviceProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.tcs_to_act).toBe(85);
      expect(protocol.do_once).toBe(-1);
    });

    it("should reject invalid tcs_to_act percentage", () => {
      const invalidTcs = [
        {
          label: "invalid_tcs",
          tcs_to_act: 150, // Above 100%
        },
      ];

      const result = validateProtocolJson(invalidTcs);

      expect(result.success).toBe(false);
    });
  });

  describe("Special Measurements Validation", () => {
    it("should validate SPAD measurements", () => {
      const spadProtocol = [
        {
          label: "spad_test",
          spad: [1],
          environmental: [["light_intensity"]],
        },
      ];

      const result = validateProtocolJson(spadProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.spad).toEqual([1]);
    });

    it("should validate calibration measurements", () => {
      const calProtocol = [
        {
          label: "calibration_test",
          get_blank_cal: [12, 20],
          get_ir_baseline: [15, 14],
          get_offset: 1,
        },
      ];

      const result = validateProtocolJson(calProtocol);

      expect(result.success).toBe(true);
      const protocol = result.data?.[0] as ProtocolSet;
      expect(protocol.get_blank_cal).toEqual([12, 20]);
      expect(protocol.get_offset).toBe(1);
    });
  });

  describe("Multi-Protocol Set Validation", () => {
    it("should validate complex multi-protocol configuration", () => {
      const multiProtocol = [
        {
          _protocol_set_: [
            {
              label: "no_leaf_baseline",
              environmental: [["light_intensity"], ["temperature_humidity_pressure"]],
              averages: 1,
            },
            {
              label: "DIRK_ECS",
              autogain: [
                [2, 1, 3, 12, 50000],
                [3, 8, 1, 80, 50000],
              ],
              pulse_distance: [1500, 1500, 1500],
              pulse_length: [["a_d2"], ["a_d2"], ["a_d2"]],
              nonpulsed_lights_brightness: [["light_intensity"], [0], ["light_intensity"]],
              environmental: [["thickness"]],
              averages: 1,
            },
            {
              label: "PAM",
              pulses: [150, 20, 20, 50, 20],
              act_intensities: [0, 125, 0, 750, 0],
              detectors: [[34], [34], [34], [34], [34]],
              pulsed_lights: [[1], [1], [1], [1], [1]],
              environmental: [
                ["light_intensity", 0],
                ["temperature", 0],
              ],
              averages: 1,
            },
            {
              label: "SPAD",
              spad: [1],
              environmental: [["light_intensity"]],
              averages: 1,
            },
          ],
        },
      ];

      const result = validateProtocolJson(multiProtocol);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
      if (result.data?.[0]) {
        expect(isMultiProtocolSet(result.data[0])).toBe(true);

        if (isMultiProtocolSet(result.data[0]) && result.data[0]._protocol_set_) {
          const protocolSet: ProtocolSet[] = result.data[0]._protocol_set_;
          expect(protocolSet).toHaveLength(4);
          expect(protocolSet[0].label).toBe("no_leaf_baseline");
          expect(protocolSet[1].label).toBe("DIRK_ECS");
          expect(protocolSet[2].label).toBe("PAM");
          expect(protocolSet[3].label).toBe("SPAD");
          expect(protocolSet[3].spad).toEqual([1]);
        }
      }
    });

    it("should validate mixed single and multi-protocol array", () => {
      const mixedProtocol = [
        { label: "single_protocol", environmental: [["light_intensity"]] },
        {
          _protocol_set_: [
            { label: "multi_1", averages: 1 },
            { label: "multi_2", spad: [1] },
          ],
        },
      ];

      const result = validateProtocolJson(mixedProtocol);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      if (result.data?.length === 2) {
        expect(isMultiProtocolSet(result.data[1])).toBe(true);
      }
    });

    it("should fail to validate complex multi-protocol configuration with errors", () => {
      const multiProtocol = [
        {
          _protocol_set_: [
            {
              label: "no_leaf_baseline",
              environmental: [["light_intensity"], ["temperature_humidity_pressure"]],
              averages: -1,
            },
            {
              label: "DIRK_ECS",
              autogain: [
                [2, 1, 3, 12, 50000],
                [3, 8, 1, 80, 50000],
              ],
              pulse_distance: [1500, 1500, 1500],
              pulse_length: [["a_d2"], ["a_d2"], ["a_d2"]],
              nonpulsed_lights_brightness: [["light_intensity"], [0], ["light_intensity"]],
              environmental: [["thickness"]],
              averages: 1,
            },
            {
              label: "PAM",
              pulses: [150, 20, 20, 50, 20],
              act_intensities: [0, 125, 0, 750, 0],
              detectors: [[34], [34], [34], [34], [34]],
              pulsed_lights: [[1], [1], [1], [1], [1]],
              environmental: [
                ["light_intensity", 0],
                ["temperature", 0],
              ],
              averages: 1,
            },
            {
              spad: [1],
              environmental: [["light_intensity"]],
              averages: 1,
            },
          ],
        },
      ];

      const result = validateProtocolJson(multiProtocol);

      expect(result.success).toBe(false);
    });
  });

  describe("Utility Functions", () => {
    const testProtocolSet: ProtocolSet = {
      label: "test_protocol",
      environmental: [["light_intensity"], ["temperature", 0], ["compass_and_angle"]],
      act1_lights: [20, 20, 0],
      pulsed_lights: [[1, 2], [3]],
      detectors: [[34], [35, 1]],
    };

    it("should extract environmental sensors", () => {
      const sensors = getEnvironmentalSensors(testProtocolSet);

      expect(sensors).toEqual(["light_intensity", "temperature", "compass_and_angle"]);
    });

    it("should extract light pins", () => {
      const lightPins = getLightPins(testProtocolSet);

      expect([...lightPins].sort((a, b) => a - b)).toEqual([1, 2, 3, 20]);
    });

    it("should extract detector pins", () => {
      const detectorPins = getDetectorPins(testProtocolSet);

      expect(detectorPins).toEqual([1, 34, 35]);
    });

    it("should extract protocol sets from complex JSON", () => {
      const complexJson = [
        { label: "single" },
        { _protocol_set_: [{ label: "multi_1" }, { label: "multi_2" }] },
      ];

      const sets = extractProtocolSets(complexJson);

      expect(sets).toHaveLength(3);
      expect(sets.map((s) => s.label)).toEqual(["single", "multi_1", "multi_2"]);
    });
  });

  describe("Error Handling", () => {
    it("should provide detailed validation errors", () => {
      const invalidProtocol = [
        {
          label: "error_test",
          averages: -1, // Should be positive
          act_intensities: [5000], // Above max range
          autogain: [[1, 2, 5, 10, 50000]], // gain_level should be 1-4
        },
      ];

      const result = validateProtocolJson(invalidProtocol);

      expect(result.success).toBe(false);
      expect(result.error?.length).toBeGreaterThan(0); // Has errors

      const errorMessages = result.error?.map((e) => e.message) ?? [];
      expect(errorMessages.some((msg) => msg.includes("Number must be"))).toBe(true);
    });
  });

  describe("Real-World Protocol Examples", () => {
    it("should validate Photosynthesis RIDES protocol", () => {
      const ridesProtocol = [
        {
          _protocol_set_: [
            {
              label: "no_leaf_baseline",
              par_led_start_on_open: 2,
              energy_save_timeout: 300000,
              energy_min_wake_time: 7000,
              environmental: [
                ["light_intensity"],
                ["temperature_humidity_pressure"],
                ["contactless_temp"],
                ["compass_and_angle"],
              ],
              averages: 1,
            },
            {
              label: "DIRK_ECS",
              par_led_start_on_close: 2,
              protocols_delay: 10,
              autogain: [
                [2, 1, 3, 12, 50000],
                [3, 8, 1, 80, 50000],
              ],
              environmental: [["light_intensity"], ["thickness"]],
              averages: 1,
              pulse_distance: [1500, 1500, 1500, 1500, 1500],
              pulse_length: [["a_d2"], ["a_d2"], ["a_d2"], ["a_d2"], ["a_d2"]],
              nonpulsed_lights_brightness: [
                ["light_intensity"],
                ["light_intensity"],
                [0],
                ["light_intensity"],
                [0],
              ],
            },
          ],
        },
      ];

      const result = validateProtocolJson(ridesProtocol);

      expect(result.success).toBe(true);

      if (result.data?.[0]._protocol_set_) {
        const protocols = result.data[0]._protocol_set_;
        expect(protocols[0].energy_save_timeout).toBe(300000);
        expect(protocols[1].autogain).toHaveLength(2);
        expect(protocols[1].pulse_distance).toHaveLength(5);
      }
    });

    it("should validate simple environmental protocol", () => {
      const envProtocol = [
        {
          averages: 1,
          environmental: [["light_intensity", 0]],
        },
      ];

      const result = validateProtocolJson(envProtocol);

      expect(result.success).toBe(true); // Single protocols don't require labels
    });

    it("should validate corrected environmental protocol", () => {
      const envProtocol = [
        {
          label: "environmental_only",
          averages: 1,
          environmental: [["light_intensity", 0]],
        },
      ];

      const result = validateProtocolJson(envProtocol);

      expect(result.success).toBe(true);
    });

    it("should validate corrected UNZA PIRK DIRK LightPotential14 protocol", () => {
      const protocol = [
        {
          // "Share":1 this tells the old PhotosynQ platform to let people share the protocol. This was a workaround to deal with the problem that the platform downloaded the entire set of thousands of of protocols to the App.

          share: 1,

          // "v_arrays" is a list of variables that can be used in the maing part of the code. they are zero-indexes and can be accessed with various indexing pointers, as describved int he following,.

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

              { label: "Missing", par_led_start_on_close: 2, do_once: 1 },

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
              // In the case @s, the indexing refers to the "set_repeat" which refers to how many time we have looped through the set (main protocol).

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
                  ["@s3" + "" + "" + "", 0],
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

      const result = validateProtocolJson(protocol);

      expect(result.success).toBe(true);
    });
  });
});

describe("Code to determine error line numbers", () => {
  it("should return correct line numbers for protocol set", () => {
    const code =
      "[\n" + // line 1
      "  {\n" +
      '    "share": 1,\n' +
      '    "v_arrays": [\n' +
      "      [\n" +
      "        100\n" +
      "      ],\n" +
      "      [\n" +
      "        200\n" +
      "      ],\n" + // line 10
      "      [\n" +
      "        2000\n" +
      "      ]\n" +
      "    ],\n" +
      '    "set_repeats": "#l3",\n' +
      '    "_protocol_set_": [\n' +
      "      {\n" +
      '        "label": "start_time",\n' +
      '        "e_time": 0\n' +
      "      },\n" + // line 20
      "      {\n" +
      '        "label": "capture_PAR",\n' +
      '        "par_led_start_on_open": 2,\n' +
      '        "averages": -21,\n' +
      '        "do_once": 1\n' +
      "      },\n" +
      "      {\n" +
      '        "par_led_start_on_close": 2,\n' +
      '        "do_once": 1,\n' +
      '        "averages": -1\n' + // line 30
      "      },\n" +
      "      {\n" +
      '        "label": "env",\n' +
      '        "environmental": [\n' +
      "          [\n" +
      '            "light_intensity"\n' +
      "          ],\n" +
      "          [\n" +
      '            "temperature_humidity_pressure"\n' +
      "          ],\n" + // line 40
      "          [\n" +
      '            "temperature_humidity_pressure2"\n' +
      "          ],\n" +
      "          [\n" +
      '            "contactless_temp"\n' +
      "          ],\n" +
      "          [\n" +
      '            "compass_and_angle"\n' +
      "          ]\n" +
      "        ],\n" + // line 40
      '        "do_once": 1\n' +
      "      }\n" +
      "    ]\n" +
      "  }\n" +
      "]"; // line 45

    const protocol: unknown = JSON.parse(code);
    const result = validateProtocolJson(protocol);
    expect(result.success).toBe(false);
    expect(result.error?.length).toBe(2);
    if (result.error !== undefined) {
      const errorInfo1 = findProtocolErrorLine(code, result.error[0]);
      expect(errorInfo1).toStrictEqual({
        line: 24,
        message: "Item 'averages': Number must be greater than 0",
      });
      const errorInfo2 = findProtocolErrorLine(code, result.error[1]);
      expect(errorInfo2).toStrictEqual({
        line: 30,
        message: "Item 'averages': Number must be greater than 0",
      });
    }
  });

  it("should return correct line numbers for simple protocol", () => {
    const code =
      "[\n" + // Line 1
      "  {\n" +
      '    "act_background_light": 20,\n' +
      '    "environmental": [\n' +
      "      [\n" +
      '        "light_intensity",\n' +
      "        0\n" +
      "      ],\n" +
      "      [\n" +
      '        "relative_humidity",\n' + // Line 10
      "        0\n" +
      "      ],\n" +
      "      [\n" +
      '        "temperature",\n' +
      "        0\n" +
      "      ]\n" +
      "    ],\n" +
      '    "get_ir_baseline": [\n' +
      "      -15,\n" +
      "      14\n" + // Line 20
      "    ],\n" +
      '    "pulses": [\n' +
      "      500,\n" +
      "      20,\n" +
      "      20,\n" +
      "      50,\n" +
      "      20\n" +
      "    ],\n" +
      '    "protocols_delay": 4,\n' +
      '    "tcs_to_act": 100,\n' + // Line 30
      '    "act1_lights": [\n' +
      "      20,\n" +
      "      20,\n" +
      "      20,\n" +
      "      20,\n" +
      "      20\n" +
      "    ],\n" +
      '    "act_intensities": [\n' +
      "      -1,\n" +
      "      -1,\n" + // Line 40
      "      -1,\n" +
      "      692,\n" +
      "      -1\n" +
      "    ],\n" +
      '    "cal_intensities": [\n' +
      "      0,\n" +
      "      4095,\n" +
      "      0,\n" +
      "      0,\n" +
      "      0\n" + // Line 50
      "    ],\n" +
      '    "meas_intensities": [\n' +
      "      0,\n" +
      "      0,\n" +
      "      4095,\n" +
      "      4095,\n" +
      "      4095\n" +
      "    ],\n" +
      '    "pulsedistance": 10000,\n' +
      '    "pulsesize": -10,\n' + // Line 60
      '    "detectors": [\n' +
      "      [\n" +
      "        34\n" +
      "      ],\n" +
      "      [\n" +
      "        34\n" +
      "      ],\n" +
      "      [\n" +
      "        34\n" +
      "      ],\n" + // Line 70
      "      [\n" +
      "        34\n" +
      "      ],\n" +
      "      [\n" +
      "        34\n" +
      "      ]\n" +
      "    ],\n" +
      '    "meas_lights": [\n' +
      "      [\n" +
      "        0\n" + // Line 80
      "      ],\n" +
      "      [\n" +
      "        14\n" +
      "      ],\n" +
      "      [\n" +
      "        15\n" +
      "      ],\n" +
      "      [\n" +
      "        15\n" +
      "      ],\n" + // Line 90
      "      [\n" +
      "        15\n" +
      "      ]\n" +
      "    ]\n" +
      "  }\n" +
      "]"; // Line 96

    const protocol: unknown = JSON.parse(code);
    const result = validateProtocolJson(protocol);
    expect(result.success).toBe(false);
    expect(result.error?.length).toBe(2);
    if (result.error !== undefined) {
      const errorInfo1 = findProtocolErrorLine(code, result.error[0]);
      expect(errorInfo1).toStrictEqual({
        line: 60,
        message: "Item 'pulsesize': Number must be greater than 0",
      });
      const errorInfo2 = findProtocolErrorLine(code, result.error[1]);
      expect(errorInfo2).toStrictEqual({
        line: 18,
        message: "Item 'get_ir_baseline': Invalid pin number",
      });
    }
  });

  it("should validate protocol with inc_ri", () => {
    const envProtocol = [
      {
        inc_ri: 1,
        environmental: [["light_intensity", 0]],
      },
    ];

    const result = validateProtocolJson(envProtocol);

    expect(result.success).toBe(true);
  });
});
