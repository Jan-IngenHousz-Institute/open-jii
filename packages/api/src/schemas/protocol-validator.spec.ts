import {
  validateProtocolJson,
  validateProtocolJsonArray,
  isMultiProtocolSet,
  extractProtocolSets,
  getEnvironmentalSensors,
  getLightPins,
  getDetectorPins,
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

        if (isMultiProtocolSet(result.data[0])) {
          const protocolSet = result.data[0]._protocol_set_;
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
    it("should validate batch processing with mixed results", () => {
      const jsonArray = [
        JSON.stringify([{ label: "valid1" }]),
        JSON.stringify([{ measurements: -1 }]),
        JSON.stringify([{ label: "valid2" }]),
        JSON.stringify([{ invalid_field: "no_label" }]),
      ];

      const result = validateProtocolJsonArray(jsonArray);

      expect(result.totalProcessed).toBe(4);
      expect(result.validCount).toBe(3); // The no_label protocol is now valid
      expect(result.errorCount).toBe(1);
      expect(result.validProtocols).toHaveLength(3);
      expect(result.errors).toHaveLength(1);
    });

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

      if (result.data?.[0] && isMultiProtocolSet(result.data[0])) {
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
  });
});
