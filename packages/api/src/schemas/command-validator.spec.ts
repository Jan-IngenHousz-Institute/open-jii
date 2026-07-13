import { describe, it, expect } from "vitest";

import {
  validateCommandJson,
  isMultiCommandSet,
  extractCommandSets,
  getEnvironmentalSensors,
  getLightPins,
  getDetectorPins,
  findCommandErrorLine,
} from "./command-validator";
import type { CommandSet } from "./command-validator";

describe("Comprehensive Command JSON Validator", () => {
  describe("Basic Command Validation", () => {
    it("should validate minimal command with only label", () => {
      const minimal = [{ label: "test_command" }];
      const result = validateCommandJson(minimal);

      expect(result.success).toBe(true);
      expect(result.data?.[0]).toHaveProperty("label", "test_command");
    });

    it("should accept commands without label (single commands)", () => {
      const missingLabel = [{ averages: 1 }];
      const result = validateCommandJson(missingLabel);

      expect(result.success).toBe(true); // Single commands don't require labels
    });

    it("should validate all basic control fields", () => {
      const basicCommand = [
        {
          label: "comprehensive_test",
          averages: 5,
          averages_delay: 100,
          averages_delay_ms: 250,
          commands: 2,
          commands_delay: 10,
          measurements: 60,
          measurements_delay: 5,
        },
      ];

      const result = validateCommandJson(basicCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.averages).toBe(5);
      expect(command.measurements).toBe(60);
    });
  });

  describe("Light Configuration Validation", () => {
    it("should validate pulse configuration", () => {
      const pulseCommand = [
        {
          label: "pulse_test",
          pulses: [150, 20, 50, 100],
          pulsesize: 10,
          pulsedistance: 1500,
          pulse_distance: [1000, 1500, 2000],
          pulse_length: [["a_d2"], [30, "a_d3"], ["a_b1"]],
        },
      ];

      const result = validateCommandJson(pulseCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.pulses).toEqual([150, 20, 50, 100]);
      expect(command.pulse_length).toHaveLength(3);
    });

    it("should validate light source hardware pins", () => {
      const lightCommand = [
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

      const result = validateCommandJson(lightCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.act_background_light).toBe(20);
      expect(command.pulsed_lights?.[2]).toEqual([3, 8]);
    });

    it("should reject invalid pin numbers", () => {
      const invalidPin = [
        {
          label: "invalid_pin_test",
          act1_lights: [99], // Invalid pin number
        },
      ];

      const result = validateCommandJson(invalidPin);

      expect(result.success).toBe(false);
      expect(result.error?.[0].message).toContain("Invalid pin number");
    });

    it("should validate light intensities including ambient (-1)", () => {
      const intensityCommand = [
        {
          label: "intensity_test",
          act_intensities: [-1, 0, 125, 750, 4095],
          cal_intensities: [4095, 0, 2000],
          meas_intensities: [2465, 3000, 4000],
          pulsed_lights_brightness: [["a_b2"], [400, "auto_bright3"]],
          nonpulsed_lights_brightness: [["light_intensity"], [8000], [0]],
        },
      ];

      const result = validateCommandJson(intensityCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.act_intensities).toContain(-1); // Ambient light
      expect(command.act_intensities).toContain(4095); // Max intensity
    });

    it("should reject out-of-range light intensities", () => {
      const invalidIntensity = JSON.stringify([
        {
          label: "invalid_intensity",
          act_intensities: [5000], // Above max 4095
        },
      ]);

      const result = validateCommandJson(invalidIntensity);

      expect(result.success).toBe(false);
    });
  });

  describe("Environmental Sensor Validation", () => {
    it("should validate all environmental sensor types", () => {
      const envCommand = [
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

      const result = validateCommandJson(envCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.environmental).toHaveLength(13);
      expect(command.environmental?.[10]).toEqual(["analog_read", 5, 40]);
    });
  });

  describe("Advanced Configuration Validation", () => {
    it("should validate autogain configuration", () => {
      const autogainCommand = [
        {
          label: "autogain_test",
          autogain: [
            [2, 1, 3, 12, 50000],
            [3, 8, 1, 80, 50000],
            [1, 34, 4, 100, 60000],
          ],
        },
      ];

      const result = validateCommandJson(autogainCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.autogain).toHaveLength(3);
      expect(command.autogain?.[0]).toEqual([2, 1, 3, 12, 50000]);
    });

    it("should validate pre-illumination settings", () => {
      const preIllumCommand = [
        {
          label: "pre_illum_test",
          pre_illumination: [2, "@s2", 300],
        },
      ];

      const result = validateCommandJson(preIllumCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.pre_illumination).toEqual([2, "@s2", 300]);
    });

    it("should validate device control fields", () => {
      const deviceCommand = [
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

      const result = validateCommandJson(deviceCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.tcs_to_act).toBe(85);
      expect(command.do_once).toBe(-1);
    });

    it("should reject invalid tcs_to_act percentage", () => {
      const invalidTcs = [
        {
          label: "invalid_tcs",
          tcs_to_act: 150, // Above 100%
        },
      ];

      const result = validateCommandJson(invalidTcs);

      expect(result.success).toBe(false);
    });
  });

  describe("Special Measurements Validation", () => {
    it("should validate SPAD measurements", () => {
      const spadCommand = [
        {
          label: "spad_test",
          spad: [1],
          environmental: [["light_intensity"]],
        },
      ];

      const result = validateCommandJson(spadCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.spad).toEqual([1]);
    });

    it("should validate calibration measurements", () => {
      const calCommand = [
        {
          label: "calibration_test",
          get_blank_cal: [12, 20],
          get_ir_baseline: [15, 14],
          get_offset: 1,
        },
      ];

      const result = validateCommandJson(calCommand);

      expect(result.success).toBe(true);
      const command = result.data?.[0] as CommandSet;
      expect(command.get_blank_cal).toEqual([12, 20]);
      expect(command.get_offset).toBe(1);
    });
  });

  describe("Multi-Command Set Validation", () => {
    it("should validate complex multi-command configuration", () => {
      const multiCommand = [
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

      const result = validateCommandJson(multiCommand);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
      if (result.data?.[0]) {
        expect(isMultiCommandSet(result.data[0])).toBe(true);

        if (isMultiCommandSet(result.data[0]) && result.data[0]._protocol_set_) {
          const commandSet: CommandSet[] = result.data[0]._protocol_set_;
          expect(commandSet).toHaveLength(4);
          expect(commandSet[0].label).toBe("no_leaf_baseline");
          expect(commandSet[1].label).toBe("DIRK_ECS");
          expect(commandSet[2].label).toBe("PAM");
          expect(commandSet[3].label).toBe("SPAD");
          expect(commandSet[3].spad).toEqual([1]);
        }
      }
    });

    it("should validate mixed single and multi-command array", () => {
      const mixedCommand = [
        { label: "single_command", environmental: [["light_intensity"]] },
        {
          _protocol_set_: [
            { label: "multi_1", averages: 1 },
            { label: "multi_2", spad: [1] },
          ],
        },
      ];

      const result = validateCommandJson(mixedCommand);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      if (result.data?.length === 2) {
        expect(isMultiCommandSet(result.data[1])).toBe(true);
      }
    });

    it("should fail to validate complex multi-command configuration with errors", () => {
      const multiCommand = [
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

      const result = validateCommandJson(multiCommand);

      expect(result.success).toBe(false);
    });
  });

  describe("Utility Functions", () => {
    const testCommandSet: CommandSet = {
      label: "test_command",
      environmental: [["light_intensity"], ["temperature", 0], ["compass_and_angle"]],
      act1_lights: [20, 20, 0],
      pulsed_lights: [[1, 2], [3]],
      detectors: [[34], [35, 1]],
    };

    it("should extract environmental sensors", () => {
      const sensors = getEnvironmentalSensors(testCommandSet);

      expect(sensors).toEqual(["light_intensity", "temperature", "compass_and_angle"]);
    });

    it("should extract light pins", () => {
      const lightPins = getLightPins(testCommandSet);

      expect([...lightPins].sort((a, b) => a - b)).toEqual([1, 2, 3, 20]);
    });

    it("should extract detector pins", () => {
      const detectorPins = getDetectorPins(testCommandSet);

      expect(detectorPins).toEqual([1, 34, 35]);
    });

    it("should extract command sets from complex JSON", () => {
      const complexJson = [
        { label: "single" },
        { _protocol_set_: [{ label: "multi_1" }, { label: "multi_2" }] },
      ];

      const sets = extractCommandSets(complexJson);

      expect(sets).toHaveLength(3);
      expect(sets.map((s) => s.label)).toEqual(["single", "multi_1", "multi_2"]);
    });
  });

  describe("Error Handling", () => {
    it("should provide detailed validation errors", () => {
      const invalidCommand = [
        {
          label: "error_test",
          averages: -1, // Should be positive
          act_intensities: [5000], // Above max range
          autogain: [[1, 2, 5, 10, 50000]], // gain_level should be 1-4
        },
      ];

      const result = validateCommandJson(invalidCommand);

      expect(result.success).toBe(false);
      expect(result.error?.length).toBeGreaterThan(0); // Has errors

      const errorMessages = result.error?.map((e) => e.message) ?? [];
      expect(errorMessages.some((msg) => msg.includes("Number must be"))).toBe(true);
    });
  });

  describe("Real-World Command Examples", () => {
    it("should validate Photosynthesis RIDES command", () => {
      const ridesCommand = [
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
              commands_delay: 10,
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

      const result = validateCommandJson(ridesCommand);

      expect(result.success).toBe(true);

      if (result.data?.[0]._protocol_set_) {
        const commands = result.data[0]._protocol_set_;
        expect(commands[0].energy_save_timeout).toBe(300000);
        expect(commands[1].autogain).toHaveLength(2);
        expect(commands[1].pulse_distance).toHaveLength(5);
      }
    });

    it("should validate simple environmental command", () => {
      const envCommand = [
        {
          averages: 1,
          environmental: [["light_intensity", 0]],
        },
      ];

      const result = validateCommandJson(envCommand);

      expect(result.success).toBe(true); // Single commands don't require labels
    });

    it("should validate corrected environmental command", () => {
      const envCommand = [
        {
          label: "environmental_only",
          averages: 1,
          environmental: [["light_intensity", 0]],
        },
      ];

      const result = validateCommandJson(envCommand);

      expect(result.success).toBe(true);
    });

    it("should validate corrected UNZA PIRK DIRK LightPotential14 command", () => {
      const command = [
        {
          // "Share":1 this tells the old PhotosynQ platform to let people share the command. This was a workaround to deal with the problem that the platform downloaded the entire set of thousands of of commands to the App.

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

          // The command contains a set of sub-commands.
          // set_repeats sets the number of repeats for tthe entire set

          //  "#l3" tells the find the length of the 3rd array in v_arrays
          //  and set the number of repeats of the entire set of sub-commands

          // A list containing the set of sub-commands

          _protocol_set_:
            // In general, it is a good idea to have a label for each
            // sub-command so that the macro can find the results using
            // the GetCommandByLabel command.
            // Note that if the subcommand is repeated, the GetCommandByLabel
            // command will return a list with all repeats.
            [
              { label: "start_time", e_time: 0 },

              // start time sets reports the innitial time
              // e_time reports the elapsed time.
              // label is important because it allows the macro to find the data from each
              // sub-commands

              { label: "capture_PAR", par_led_start_on_open: 2, averages: 1, do_once: 1 },

              // "par_led_start_on_open": 2 tells instrument to wait until the clamp is opened. While waiting, continuously meaured PAR and reproduce the same value in the clamp using LED #2

              // "do_once":1 tells to perform this sub_command only on the first repeat of the set_repeats. (Note this is not zero indexed)

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

              // This sub-command performs three autogain settings
              //
              // "autogain" accepts a list of lists, each sub-list setting up an autogain
              // process:
              // [auto_gain_index, led#, detector#, pulse duraction, target ADC value]

              // auto_gain_index is used to insert autogain values infor use in a sub-command

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

              // In the following command are defined 3 different sub-command: PIRKS, PAM-ABS and PAM-ABS-FR
              // A sub-command is composed of:
              // 							- a measuring ligh, a pulsed light that will probe the photosynthetic state of the leaf.
              //							- an actinic light (or background light), a light that will be set to a fix intensity and induce photosynthesis.
              // A sub-command is organized as a serie of measuring pulses with usually a constant intensity and duration,
              // but often with a variable distance between them (defining the sampling speed) and changes in the background light intensity.
              // // The pulses can be detected either by:
              // 								- a detector with a long-pass filter that detect in the infrared,
              // 								- or a dector detecting in the visible range.

              // We are going to take for example the PIRK sub-command that is defined here below with label "PIRK"
              // The sub-command start with a period of pre-illumination, which is a period in which a background light is applied and where NO pulses for measurments are applied,
              // In this example the PIRK sub-command is composed of 5 pulses "block".
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
              // In the case of @p, the indexing change according the command repeat index.
              // For example "@p0" will refer to the v_array[0][#command_repeat] and at the first time the command is repeated it will call v_array[0][0] and return 0
              // In the case @s, the indexing refers to the "set_repeat" which refers to how many time we have looped through the set (main command).

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
                command_repeats: 1,
              },

              // This sub-command is a bit more complex, it will measure two spectroscopic signal almost simultaneously.
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
                command_repeats: 1,
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
                command_repeats: 1,
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

      const result = validateCommandJson(command);

      expect(result.success).toBe(true);
    });
  });
});

describe("Code to determine error line numbers", () => {
  it("should return correct line numbers for command set", () => {
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

    const command: unknown = JSON.parse(code);
    const result = validateCommandJson(command);
    expect(result.success).toBe(false);
    expect(result.error?.length).toBe(2);
    if (result.error !== undefined) {
      const errorInfo1 = findCommandErrorLine(code, result.error[0]);
      expect(errorInfo1).toStrictEqual({
        line: 24,
        message: "Item 'averages': Number must be greater than 0",
      });
      const errorInfo2 = findCommandErrorLine(code, result.error[1]);
      expect(errorInfo2).toStrictEqual({
        line: 30,
        message: "Item 'averages': Number must be greater than 0",
      });
    }
  });

  it("should return correct line numbers for simple command", () => {
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
      '    "commands_delay": 4,\n' +
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

    const command: unknown = JSON.parse(code);
    const result = validateCommandJson(command);
    expect(result.success).toBe(false);
    expect(result.error?.length).toBe(2);
    if (result.error !== undefined) {
      const errorInfo1 = findCommandErrorLine(code, result.error[0]);
      expect(errorInfo1).toStrictEqual({
        line: 60,
        message: "Item 'pulsesize': Number must be greater than 0",
      });
      const errorInfo2 = findCommandErrorLine(code, result.error[1]);
      expect(errorInfo2).toStrictEqual({
        line: 18,
        message: "Item 'get_ir_baseline': Invalid pin number",
      });
    }
  });

  it("should validate command with inc_ri", () => {
    const envCommand = [
      {
        inc_ri: 1,
        environmental: [["light_intensity", 0]],
      },
    ];

    const result = validateCommandJson(envCommand);

    expect(result.success).toBe(true);
  });
});
