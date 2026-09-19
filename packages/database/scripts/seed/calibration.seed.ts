import { and } from "drizzle-orm";

import { zCreateCalibrationDefinitionBody } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { db } from "../../src/database";
import { calibrationDefinitions, calibrationRuns, deviceCalibrations } from "../../src/schema";
import type { SeedDevice, SeedUser } from "./types";

/** The bench procedures as definitions, plus the one run a real sensor actually produced. */
export async function seedCalibrations(
  user: SeedUser,
  personalOrganizationId: string,
  createdDevices: SeedDevice[],
) {
  const d = createdDevices;
  // 11. Calibration: the two MiniPAR bench procedures as definitions, plus the
  // result the manual one produced on a real sensor, approved and written, so
  // the run history, the active calibration and the write report each have a
  // real row behind them before any device is plugged in.
  const miniparParFitScript = (orderedByStimulus: boolean) => `import math

from qc import assess_linear_fit

# Map the sensor's uncalibrated PAR onto the reference, y = slope * x + intercept,
# the straight line the bench procedure fits with numpy.polyfit(x, y, 1).
points = inputs["par_sweep"]
fit = assess_linear_fit(
    points["par_raw"],
    points["par_ref"],
${orderedByStimulus ? '    points["stimulus"],\n' : ""}    slope_min=0.1,
    slope_max=10.0,
    intercept_min=-100.0,
    intercept_max=100.0,
)

# The thresholds are the platform's until the scientist supplies real ones: a
# failed gate travels with the block as advice and the reviewer decides.
fitted = math.isfinite(fit["slope"]) and math.isfinite(fit["intercept"])
if fitted:
    block = {
        "status": "computed",
        "coefficients": {"slope": fit["slope"], "intercept": fit["intercept"]},
        "quality": fit,
    }
else:
    block = {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}
submit({"par": block})
`;

  const miniparOutputSchema = {
    blocks: { par: { slope: { type: "number" }, intercept: { type: "number" } } },
  };

  const miniparSpectralFitScript = `import math

from qc import assess_multilinear_fit

# The console prints the raw spectrum as "<model>,ch0,...,chN". The first ten channels
# feed a least-squares fit, y = sum(coefficient[i] * channel[i]) + intercept, which is
# what the bench procedure does before uploading the channel coefficients.
CHANNELS = 10


def channel_counts(line):
    parts = [part.strip() for part in str(line).split(",") if part.strip()]
    if parts and not parts[0][0].isdigit():
        parts = parts[1:]
    return [float(part) for part in parts[:CHANNELS]]


points = inputs["spec_sweep"]
fit = assess_multilinear_fit(
    [channel_counts(line) for line in points["spec"]],
    points["par_ref"],
    list(points["stimulus"]),
    intercept_min=-100.0,
    intercept_max=100.0,
)

# The thresholds are the platform's until the scientist supplies real ones: a
# failed gate travels with the block as advice and the reviewer decides.
fitted = all(math.isfinite(value) for value in fit["coefficients"]) and math.isfinite(
    fit["intercept"]
)
settings = {reading for reading in points["settings"]}
if len(settings) != 1:
    raise ValueError(f"the sweep ran at more than one spectrometer setting: {sorted(settings)}")

if fitted:
    # par = par_raw * slope + intercept, and par_raw is the channel sum. Leaving the
    # previous line in place would scale this fit by it, so the line is set here too.
    submit(
        {
            "spec": {
                "status": "computed",
                "coefficients": {"channel_coefficients": fit["coefficients"]},
                "quality": fit,
            },
            "par": {
                "status": "computed",
                "coefficients": {"slope": 1.0, "intercept": fit["intercept"]},
                "quality": {"passed": True, "reasons": [], "settings": settings.pop()},
            },
        }
    )
else:
    rejected = {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}
    submit({"spec": rejected, "par": rejected})
`;

  /**
   * The eleven filters the bench's own readings were taken through. Ten channel
   * coefficients and an intercept are fitted from them, which eleven distinct spectra
   * cannot determine: the fit is rejected for conditioning, and sampling each filter at
   * more light levels does not help, because brightness moves along a spectrum rather
   * than adding a new one. What would help is more distinct sources, which is a question
   * about the optics on the bench.
   */
  const spectralFilters = [
    "no filter",
    "filter e002",
    "filter e003",
    "filter e004",
    "filter e007",
    "filter e008",
    "filter e009",
    "filter e010",
    "filter e013",
    "filter e015",
    "filter e017",
  ];

  const spectralSweepPoints = [...spectralFilters, "the dark cap"];

  const miniparSpectralOutputSchema = {
    blocks: {
      spec: { channel_coefficients: { type: "number_array", length: 10 } },
      par: { slope: { type: "number" }, intercept: { type: "number" } },
    },
  };

  const ambitFactoryScript = `import json
import math

from qc import assess_origin_fit

# The PAR console answers its reading and its spectral channels together.
def par_reading(reply):
    return float(json.loads(str(reply))["par"])


par_points = inputs["par_sweep"]
par_fit = assess_origin_fit(
    [par_reading(reply) for reply in par_points["par"]],
    par_points["par_ref"],
    par_points["stimulus"],
    coefficient_min=0.05,
    coefficient_max=100.0,
)

# The actinic curve is fitted the other way round: the reference reads the light the
# LED made, and the coefficient turns that light back into the setting behind it.
led_points = inputs["led_sweep"]
led_fit = assess_origin_fit(
    led_points["emit_ref"],
    led_points["stimulus"],
    led_points["stimulus"],
    coefficient_min=0.01,
    coefficient_max=1.0,
)

CHANNEL_0_DARK_MAX = 400
channels = [int(value) for value in inputs["adpd_baseline"]["channels"][0]]
is_dark = channels[0] <= CHANNEL_0_DARK_MAX


def gain_block(fit, name):
    if math.isfinite(fit["coefficient"]):
        return {
            "status": "computed",
            "coefficients": {name: fit["coefficient"]},
            "quality": fit,
        }
    return {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}


# A baseline that never went dark is advice, not a refusal: the reviewer decides,
# the same way a failed fit gate travels with its block.
submit(
    {
        "par": gain_block(par_fit, "spec"),
        "led": gain_block(led_fit, "act"),
        "baseline": {
            "status": "computed",
            "coefficients": {"channels": channels},
            "quality": {
                "passed": is_dark,
                "reasons": [] if is_dark else ["the first channel is too bright for a dark baseline"],
                "channel_0": channels[0],
                "thresholds": {"channel_0_max": CHANNEL_0_DARK_MAX},
            },
        },
    }
)
`;

  const ambitOutputSchema = {
    blocks: {
      par: { spec: { type: "number", min: 0.05, max: 100 } },
      led: { act: { type: "number", min: 0.01, max: 1 } },
      baseline: { channels: { type: "integer_array", length: 6, min: 0, max: 16777215 } },
    },
  };

  // Which spectrometer channel sees each LED best, and where its usable range starts.
  const multispeqLedChannels = [
    { led: 1, channel: 3, from: 100 },
    { led: 2, channel: 9, from: 100 },
    { led: 3, channel: 7, from: 100 },
    { led: 4, channel: 1, from: 100 },
    { led: 5, channel: 5, from: 300 },
  ];

  const ledBrightnessSteps = (from: number) =>
    Array.from({ length: 10 }, (_, index) => Math.round(from + ((800 - from) * index) / 9));

  const multispeqLedScript = `import math

from qc import assess_linear_fit

# One straight line per LED: counts rise with the setting its driver is given.
blocks = {}
for led in [${multispeqLedChannels.map(({ led }) => led).join(", ")}]:
    points = inputs[f"led_{led}"]
    fit = assess_linear_fit(
        points["stimulus"],
        points["counts"],
        points["stimulus"],
        slope_min=0.0001,
        slope_max=1000.0,
        intercept_min=-100000.0,
        intercept_max=100000.0,
    )
    fitted = math.isfinite(fit["slope"]) and math.isfinite(fit["intercept"])
    if fitted:
        blocks[f"led{led}"] = {
            "status": "computed",
            "coefficients": {"slope": fit["slope"], "intercept": fit["intercept"]},
            "quality": fit,
        }
    else:
        blocks[f"led{led}"] = {
            "status": "rejected",
            "reason": "; ".join(fit["reasons"]),
            "quality": fit,
        }

submit(blocks)
`;

  const multispeqLedOutputSchema = {
    blocks: Object.fromEntries(
      multispeqLedChannels.map(({ led }) => [
        `led${led}`,
        { slope: { type: "number" }, intercept: { type: "number" } },
      ]),
    ),
  };

  const calibrationDefinitionSeeds = [
    {
      family: "minipar",
      name: "[Seed] MiniPAR PAR calibration, manual bench",
      description:
        "Three points against a reference PAR sensor: two light levels and darkness. The operator sets the light and types the reference reading; the fit maps uncalibrated PAR onto the reference.",
      captureProcedure: {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "operator",
            prompt:
              "Place the MiniPAR next to the reference PAR sensor so both see the same light.",
          },
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              operator: "Set up {value}, then wait for both readings to settle before continuing.",
              values: ["a first light level", "a second light level", "darkness"],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
        // The bench procedure re-reads calibrated PAR beside the reference once the write is in.
        verify: [
          {
            kind: "read",
            series: "par_check",
            prompt: "Keep both sensors in the same light for the check reading.",
            read: [
              { instrument: "dut", command: "par", as: "par" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
      },
      script: miniparParFitScript(false),
      outputSchema: miniparOutputSchema,
    },
    {
      family: "minipar",
      name: "[Seed] MiniPAR PAR calibration, automated bench",
      description:
        "A DC supply steps the lamp through six currents while a MicroPython photodiode supplies the reference. The same fit as the manual bench, with the sweep ordered by lamp current.",
      captureProcedure: {
        instruments: [
          { role: "dut" },
          { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" },
          { role: "par_ref", handshake: "raw REPL", model: "micropython-par-reference" },
        ],
        steps: [
          {
            kind: "operator",
            prompt: "Aim the lamp at the MiniPAR and the reference photodiode.",
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
          { kind: "set", instrument: "lamp", set: "voltage_v", value: 25 },
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              instrument: "lamp",
              set: "current_a",
              values: [0.2, 0.4, 0.8, 1.0, 1.6, 0],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "par_raw", as: "par_raw" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
        ],
        // The bench procedure checks one lamp current after the write, then rests the lamp.
        verify: [
          { kind: "set", instrument: "lamp", set: "current_a", value: 0.8 },
          { kind: "settle", ms: 1000 },
          {
            kind: "read",
            series: "par_check",
            read: [
              { instrument: "dut", command: "par", as: "par" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
        ],
      },
      script: miniparParFitScript(true),
      outputSchema: miniparOutputSchema,
    },
    {
      family: "minipar",
      name: "[Seed] MiniPAR spectral PAR calibration, manual bench",
      description:
        "Optical filters change the spectrum in front of the MiniPAR and a reference PAR sensor. A least-squares fit maps the ten raw spectral channels onto the reference; the ten channel coefficients are written to the device and the fitted intercept is kept on the run.",
      captureProcedure: {
        instruments: [{ role: "dut" }],
        steps: [
          {
            kind: "operator",
            prompt:
              "Place the MiniPAR next to the reference PAR sensor so both see the same light through the same filter.",
          },
          {
            kind: "sweep",
            series: "spec_sweep",
            stimulus: {
              operator:
                "Cover both sensors with {value}, then wait for the readings to settle before continuing.",
              values: spectralSweepPoints,
            },
            settleMs: 1000,
            read: [
              // Basic counts, which is what the firmware multiplies its stored coefficients
              // by. Fitting the raw counts instead scales every later reading by the
              // gain and integration time the sweep happened to run at.
              { instrument: "dut", command: "spec", as: "spec" },
              // The coefficients are only valid at the gain and integration time they were
              // derived at, so every point carries the settings it was taken at.
              { instrument: "dut", command: "status", as: "settings" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
        // Three of the filters again, reading the spectral PAR the device now computes.
        verify: [
          {
            kind: "sweep",
            series: "spec_check",
            stimulus: {
              operator:
                "Cover both sensors with {value}, then wait for the readings to settle before continuing.",
              values: ["no filter", "filter e004", "the dark cap"],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "spec", as: "spec" },
              {
                operator: "Enter the PAR value shown by the reference sensor",
                as: "par_ref",
                type: "number",
              },
            ],
          },
        ],
      },
      script: miniparSpectralFitScript,
      outputSchema: miniparSpectralOutputSchema,
    },
    {
      family: "ambit",
      name: "[Seed] Ambit factory calibration",
      description:
        "The factory bench in one procedure: a lamp sweep against a PAR reference fits the sensor's PAR gain, an actinic sweep against a second reference fits its LED gain, and a covered sensor measures the dark baseline of its six detector channels.",
      captureProcedure: {
        instruments: [
          { role: "dut" },
          { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" },
          { role: "par_ref", handshake: "Par_REF", model: "minipar-reference" },
          { role: "emit_ref", handshake: "Emit_LED", model: "minipar-reference" },
        ],
        steps: [
          {
            kind: "operator",
            prompt:
              "Aim the lamp at the sensor and the PAR reference, and place the emission reference over the sensor's own LED.",
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
          { kind: "set", instrument: "lamp", set: "voltage_v", value: 25 },
          {
            kind: "sweep",
            series: "par_sweep",
            stimulus: {
              instrument: "lamp",
              set: "current_a",
              values: [0.8, 2.4, 3.0, 4.0, 6.6, 0],
            },
            settleMs: 1000,
            read: [
              { instrument: "dut", command: "get_par", as: "par" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
          {
            kind: "sweep",
            series: "led_sweep",
            stimulus: {
              instrument: "dut",
              set: "led_setting",
              values: [10, 20, 60, 90, 150, 250, 0],
            },
            settleMs: 400,
            read: [{ instrument: "emit_ref", command: "par", as: "emit_ref" }],
          },
          {
            kind: "operator",
            prompt: "Cover the sensor so no light reaches it, then type DARK to measure it.",
            confirm: "DARK",
          },
          {
            kind: "read",
            series: "adpd_baseline",
            // The measurement runs on the device and answers only when it is done.
            read: [{ instrument: "dut", command: "baseline,0", as: "channels", timeoutMs: 25000 }],
          },
        ],
        // The calibrated reading beside the reference at one lamp current, then the lamp off.
        verify: [
          { kind: "set", instrument: "lamp", set: "current_a", value: 0.8 },
          { kind: "settle", ms: 1000 },
          {
            kind: "read",
            series: "par_check",
            read: [
              { instrument: "dut", command: "PAR", as: "par" },
              { instrument: "par_ref", command: "par", as: "par_ref" },
            ],
          },
          { kind: "set", instrument: "lamp", set: "current_a", value: 0 },
        ],
      },
      script: ambitFactoryScript,
      outputSchema: ambitOutputSchema,
    },
    {
      family: "multispeq",
      name: "[Seed] MultispeQ LED calibration, tool board",
      description:
        "Each of the first five LEDs is stepped through ten settings while a spectrometer board reads the channel that sees it best. One line per LED relates the setting to the light it produces.",
      captureProcedure: {
        instruments: [
          { role: "dut" },
          { role: "calitool", handshake: "CaliTool", model: "calitool-spectral-board" },
        ],
        steps: [
          {
            kind: "operator",
            prompt:
              "Seat the sensor on the tool board so its LEDs shine into the spectrometer window, and shield the pair from room light.",
          },
          // The board lights its own LED at power-up and only a zero clears it, and its
          // integration step survives a port close, so both are set rather than assumed.
          { kind: "set", instrument: "calitool", set: "led_ma", value: 0 },
          { kind: "set", instrument: "calitool", set: "gain", value: 1 },
          { kind: "set", instrument: "calitool", set: "atime", value: 200 },
          { kind: "set", instrument: "calitool", set: "astep", value: 200 },
          ...multispeqLedChannels.flatMap(({ led, channel, from }) => [
            {
              kind: "sweep",
              series: `led_${led}`,
              stimulus: {
                instrument: "dut",
                set: `led_${led}`,
                values: ledBrightnessSteps(from),
              },
              settleMs: 100,
              read: [{ instrument: "calitool", command: `channel_${channel}`, as: "counts" }],
            },
            // Dark again before the next LED, so one lit LED never colours another's line.
            { kind: "set", instrument: "dut", set: `led_${led}`, value: 0 },
          ]),
        ],
      },
      script: multispeqLedScript,
      outputSchema: multispeqLedOutputSchema,
    },
  ];

  // Parsed through the contract so a seeded definition is exactly what the API would accept.
  const createdDefinitions = await db
    .insert(calibrationDefinitions)
    .values(
      calibrationDefinitionSeeds.map((seed) => ({
        ...zCreateCalibrationDefinitionBody.parse(seed),
        organizationId: personalOrganizationId,
        createdBy: user.id,
      })),
    )
    .returning();
  console.log(`  Created ${createdDefinitions.length} calibration definitions`);

  // The manual bench's real outcome on a MiniPAR: firmware 1.03 answered
  // "MiniPAR,1.1,1.03", the fit came out at slope 0.96 and intercept -1.08,
  // and the device echoed both values back when they were written.
  const benchCoefficients = { slope: 0.96, intercept: -1.08 };
  const benchTime = new Date();
  const [benchRun] = await db
    .insert(calibrationRuns)
    .values({
      definitionId: createdDefinitions[0].id,
      deviceId: d[4].id,
      requestedBy: user.id,
      inputSource: "external_bench",
      status: "approved",
      blocks: { par: { status: "computed", coefficients: benchCoefficients } },
      preInfo: { helloReply: "MiniPAR,1.1,1.03", deviceName: "miniPAR" },
      firmwareVersion: "1.03",
      reviewedBy: user.id,
      reviewedAt: benchTime,
      finishedAt: benchTime,
    })
    .returning();

  await db.insert(deviceCalibrations).values({
    deviceId: d[4].id,
    runId: benchRun.id,
    blocks: { par: { coefficients: benchCoefficients } },
    approvedBy: user.id,
    writtenToDeviceAt: benchTime,
    writeResults: { par: { verified: true } },
  });
  console.log("  Created 1 approved calibration run and the MiniPAR's active calibration");
}
