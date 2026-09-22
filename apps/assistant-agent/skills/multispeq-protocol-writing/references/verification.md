# Verification and troubleshooting

## Evidence levels

| Level                | Evidence                                                                | What it does not establish                                   |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Written design       | Question, baseline, phase map, method assumptions                       | Valid JSON or runnable acquisition.                          |
| JSON/schema          | Current `draft_entity` validation or an actual reported schema tool     | Phase alignment, firmware behavior, calibration, physiology. |
| Static analysis      | Reviewed references, channels, windows, rough timing                    | Actual signal quality or sample response.                    |
| Synthetic macro test | Actual sandbox output on independently designed fixtures                | Biological validity or device compatibility.                 |
| Saved-data replay    | Reproduced outputs on an authorized immutable raw record                | Suitability for another firmware/model or different samples. |
| Bench check          | Recorded run on the intended instrument and firmware                    | General validity across samples or devices.                  |
| Method validation    | Documented comparison, repeatability, calibration and scientific review | Permission to generalize outside the tested conditions.      |

Never upgrade an unexecuted test plan to a passed result. The current assistant can inspect resources and propose drafts; it has no device or sandbox execution tool.

## Static review checklist

- Strict JSON array, actual commands, correct sensor family, no double encoding or tutorial placeholders.
- Exact baseline revision/content and matching analysis inspected.
- Every pulse phase has defined timing, measuring channels, brightness and any background channels.
- Each variable points to an existing array/cell. Dynamic PAR and gain references have a known producer and scope.
- Set/protocol repeat expansion is finite and understood. `do_once` does not omit a required setup step later.
- Array cardinality, detector order, trace windows and repeated-label analysis agree.
- All altered physical units checked. Source disagreements recorded rather than concealed.
- Duration report separates pulse arithmetic, waits, repeats, autogain, transport, and operator actions.
- No unrequested calibration, EEPROM write, raw DAC change, firmware change, or direct pin control.

## Bench plan to give the researcher

1. Record model, serial, firmware, calibration history, connection, baseline protocol/macro revision, and sample conditions.
2. Save an untouched copy of the baseline and raw output. Follow the baseline's calibration procedure; drafting a measurement is not authorization to rewrite calibration.
3. Run the baseline using the stated sample handling. Confirm clamp prompts and observe any timeout or device warning.
4. Run the modified recipe under comparable conditions. Record actual elapsed time, raw output, sensor fields, gain values, phase lengths, and any clipping or unexpected zeros.
5. Check that the light-state sequence and saturation/relaxation behavior match the intended method. If the sample is visibly stressed or readings are unexpected, stop repeated exposure and diagnose before continuing.
6. Replay both through the paired analysis. Compare numerical outputs, diagnostics, trace shape and timing. State acceptance tolerances from the study method, not a generic threshold.
7. Repeat across representative samples and devices as required by the study. Freeze the accepted pair and workbook version, then record the tested scope and remaining limitations.

## Diagnose before changing parameters

| Symptom                                  | First checks                                                                                 | Avoid                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Protocol takes minutes or seems stuck    | Open/close gate, clamp calibration, user action, sleep/wake, transport timeout, actual waits | Shortening physiology-critical intervals without evidence.         |
| Schema passes but device ignores a field | Exact spelling, firmware version, command support                                            | Treating JSON acceptance as device acknowledgement.                |
| Very short or empty trace                | LED/detector zero, channel map, gain, framing, incomplete response                           | Padding missing data with zero to make analysis pass.              |
| Macro succeeds with empty object         | Function-body/return contract, unused helper, output rebinding                               | Calling this a successful scientific result.                       |
| Nonsensical Phi2/NPQt after reprocessing | Channel ordering, phase offsets, destructive raw mutation, normalization                     | Applying a historic repair by name without its conditions.         |
| Light curve returns one result           | Repeat expansion and helper behavior for duplicate labels                                    | Reusing first-match label lookup for all occurrences.              |
| Duration differs by 1,000×               | `protocols_delay` unit conflict, pre-illumination tuple order                                | Editing hardware timing to match an app approximation.             |
| High values flatten at a ceiling         | Detector saturation, autogain, LED/pulse settings, sample geometry                           | Treating the clipped plateau as proof of physiological saturation. |
| Site calls protocol 'compatible'         | Actual paired macro and firmware evidence                                                    | Treating a compatibility link as a validation certificate.         |

## What to preserve in a method record

Keep source/revision, researcher question, instrument configuration, protocol JSON, analysis revision, phase-to-output map, metadata questions, raw fixture provenance, all actual test reports, rejected assumptions, and approval/test status. Record who performed hardware tests and when. Never include credentials or another researcher's private measurements in shared skill content.
