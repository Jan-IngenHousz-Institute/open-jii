# Command semantics and compatibility

Checked against official pages and this checkout on 2026-09-22. This is an authoring guide, not a replacement firmware specification. Recheck changed commands against the target firmware. See [source links](sources-and-examples.md).

## The three levels of a recipe

The device receives an outer JSON array. A simple entry contains measurement commands directly. A compound entry contains `_protocol_set_`, an ordered array of blocks, plus set-level configuration such as `v_arrays` and `set_repeats`. Each pulse block contains phases indexed by `pulses`.

JSON object key order is not an instruction sequence. Block order in `_protocol_set_` is. Keep metadata and prose outside the device document. `label` identifies a block for analysis; changing it can break macro lookup even when acquisition is unchanged.

Use direct entries for small environmental measurements. Use sets when independently labeled stages or repeats are needed. PhotosynQ's macro requirement for displaying advanced-set output belongs to that platform; openJII still stores the raw response and requires a matching analysis path for derived metrics.

## Pulse phases and channel order

For phase `i`, `pulses[i]` is a cycle count. `pulse_distance[i]` and `pulse_length[i][j]` are in microseconds. The nested measuring LED, detector, pulse length, and brightness entries describe the ordered channels within that phase. Measuring LEDs fire consecutively. Multiple background LEDs in `nonpulsed_lights[i]` operate together.

For new authoring, provide an explicit entry for each phase. Check inner measuring-channel widths separately from the background-light widths. A legacy recipe may use firmware-specific repetition or shorthand; document that behavior before expanding it. openJII's chart code repeats the last array element for some missing positions, but that is not proof the target firmware does the same.

For ordinary active detector channels, a preliminary raw count is:

`sum(pulses[i] * detectors[i].length)`

The official detector tutorial illustrates two cycles with detectors `[1, 3]` as A0, B0, A1, B1. This is an example of interleaving, not a universal response layout. Adding a second channel changes the index map and revisit interval. Confirm the actual paired response before splitting: an even/odd split requires established interleaving with constant channel count and ordering. Some recorded RIDES responses instead group channels; see [analysis and integration](analysis-and-integration.md).

Zero LED or detector entries can suppress output. Official detector pages disagree about empty output versus zero-valued output. Treat those phases as requiring a raw fixture or firmware check; do not include them in an exact count assertion without evidence.

## Timing

A useful application estimate for an ordinary phase is `N * K * D / 1000` milliseconds, where N is cycles, K is measuring channels, and D is interval in microseconds. This is the model used by the local estimator. It is not an exact sampling clock: the official pulse tutorial includes pulse-width effects in multi-channel timing. Use measured timestamps or firmware evidence for kinetic fitting.

| Field                                         | Intended interpretation                                  | Authoring rule                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pulse_distance`                              | Interval, µs                                             | Preserve the baseline until changed timing is justified.                                                                  |
| `pulse_length`                                | Pulse duration, µs                                       | Affects signal as well as sample illumination.                                                                            |
| `averages_delay`, `measurements_delay`        | Delay, ms in command docs                                | Include repeated waits when budgeting duration.                                                                           |
| `protocols_delay`                             | Command docs say ms; local estimator multiplies by 1,000 | Report the conflict. Verify firmware; never compensate by editing a working recipe solely for the UI estimate.            |
| `pre_illumination`                            | Working example uses `[LED, intensity, duration_ms]`     | Preserve this ordering for that dialect. Official prose and JII generated tuple descriptions reverse the last two labels. |
| `set_led_delay`                               | `[LED, duration_ms, intensity]`                          | A different ordering; not a drop-in rename of `pre_illumination`.                                                         |
| `energy_save_timeout`, `energy_min_wake_time` | ms                                                       | Can affect subsequent device behavior until reset; keep baseline values.                                                  |

Report pulse-train arithmetic separately from unmodeled waits and repeats. The repository estimator also ignores simple direct-entry pulse blocks, unresolved values, and some command forms. Autogain, sensor acquisition, communication, and human clamp actions add time. A zero estimate does not mean instant completion.

## Light units and hardware identity

Official light documentation distinguishes calibrated PAR-range LEDs from out-of-range LEDs. For calibrated visible channels, brightness represents photon flux density in µmol photons m⁻² s⁻¹. Outside that range, the documentation describes a device scale. `dac_lights` explicitly switches to raw DAC control. The documentation itself differs on 4095 versus 4096 endpoints, so never use that boundary as a safe operating recommendation.

A value of 4500 in a published visible-light saturation example is not automatically a 12-bit overflow. Conversely, an infrared setting must not be presented as calibrated PAR. Determine the LED wavelength, position, calibration, and firmware interpretation before changing a value.

The UI's `LED_NAMES` is a visualization map, not an inventory of the connected instrument. Use device configuration or the baseline's verified hardware mapping. Pin 38 passing the broad app schema does not establish a usable LED or detector. Never infer wavelength from a pin number across models or modifications.

The PAR sensor reads incident light; `set_light_intensity` supplies a protocol value. Preserve the distinction between measured ambient PAR and a commanded chamber setting. `light_intensity`, `previous_light_intensity`, and `p_light` are dynamic values, not interchangeable constants.

## Autogain

Official command and signal-intensity pages agree on:

`[index, pulsed_LED, detector, pulse_duration_us, target_signal]`

The first slot is a storage index, not a light pin. The third is a detector, not a gain level. The final slot is target detector signal, not a timeout. Comments in openJII's current Zod tuple misleadingly label these positions; its types alone do not determine physical meaning.

Use unique indices and establish the gain before consuming `auto_durationN`, `auto_brightN`, or baseline shorthand such as `a_dN` and `a_bN`. Confirm shorthand for the firmware. Reusing gain settings with another LED/detector combination requires justification. An autogain block marked `do_once` during a changing-light series is a method decision, not an automatic optimization.

## Variables and repeats

| Form                             | Meaning                                            | Check                                                       |
| -------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `@nA:I`                          | Fixed value at array A, item I                     | Both indices exist, zero-based.                             |
| `@sA`                            | Value chosen by set repeat                         | Show each occurrence and any out-of-range case.             |
| `@pA`                            | Value chosen by protocol repeat                    | Officially documented; local estimator does not resolve it. |
| `#lA`                            | Length of array A                                  | Array exists and is not empty when used as a repeat count.  |
| `set_repeats`                    | Repeat the compound sequence                       | Use with `_protocol_set_`.                                  |
| `protocol_repeats` / `protocols` | Repetition of a block in the applicable dialect    | Check aliases and output multiplicity.                      |
| `averages` / `protocol_averages` | Repeated acquisition combined into averaged output | Not independent biological replicates.                      |
| `do_once: 1`                     | Block runs only on first set occurrence            | Check prerequisites for later blocks/repeats.               |

`do_once: -1` marks last-set execution in the UNZA dialect. When extending a light series, show first, middle and last occurrence explicitly: a `do_once: 1` setup block runs on the first; ordinary repeated acquisition runs at each condition; UNZA's `PAM-ABS-FR` and SPAD blocks marked `-1` run on the last. Adding a final condition moves those last-only stages. Confirm support against the selected firmware and baseline rather than assuming this rule for every dialect.

The variables tutorial says four arrays while JII's schema allows ten and the UNZA fixture uses eight. Record firmware/version support instead of imposing either limit universally. The local resolver supports only a subset and may clamp out-of-range set references to a last numeric value. New protocols should make repeat lengths explicit; do not depend on this application fallback as firmware behavior.

## Schema acceptance is a separate question

The reusable core `ProtocolJsonSchema` and the assistant draft schema are different validation layers. The core is strict about object keys but permissive elsewhere. It accepts an empty outer array, label-only blocks, arbitrary sensor-name strings, broad pin numbers, and unrestricted integer brightness in modern arrays. It does not cross-check phase lengths or reference definitions. The assistant-specific `draft_entity` schema adds nonempty recipe and substantive-block refinements, so an empty recipe or label-only block is rejected there. Those refinements still do not establish phase alignment, reference validity, pin identity, firmware support or physical safety.

It also rejects documented commands such as `save_trace_time_scale`, `reference`, `environmental_array`, `dac_lights`, and some variable forms accepted in other fields. Report those as target-application compatibility gaps. Do not silently remove an acquisition-critical field or weaken the schema as part of writing one protocol.

Known tutorial spelling conflicts include `_protocol_sets_`, `non_pulsed_lights_brightness`, `environmentals`, and `pulse_duration`. Use the concrete version-matched command definitions and current app keys rather than those narrative variants.
