# Translate the research question into a measurement

## Select the least complex sufficient method

| Question                                                              | Starting point                                                          | What else must be specified                                                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| How much incident light is present at sun/shade sampling positions?   | PAR/environmental read                                                  | Sensor orientation, sample location, timestamp, treatment question, repeated field sampling. No fluorescence conclusion.       |
| Does operating PSII efficiency differ between treatments under light? | Paired Phi2 or reviewed PAM method                                      | Illumination/adaptation history, Fs and Fm′ windows, saturation evidence, sample identity.                                     |
| What is maximum PSII efficiency after dark adaptation?                | Established dark-adapted Fv/Fm pair                                     | Validated dark adaptation, Fo and Fm acquisition, saturation check. An ambient Phi2 recipe is not an Fv/Fm recipe.             |
| How does photoprotection vary?                                        | Reviewed NPQ/NPQt/PhiNPQ/PhiNO pair such as an applicable RIDES version | Exact estimator, normalization, required fluorescence quantities and assumptions. NPQ and NPQt are not interchangeable labels. |
| What happens across changing actinic light?                           | Existing light-response or UNZA light-potential pair                    | Intensities, step order, hold times, equilibration criterion, carryover, matched repeat-aware macro.                           |
| Are ECS/pmf or ATP-synthase-related kinetics changing?                | Established DIRK/ECS protocol and fit                                   | LED/detector mapping, dark intervals, baseline/reference correction, gain, sample times, fitting windows and units.            |
| Are PSI/P700 responses changing?                                      | Established P700/PSI pair                                               | Absorbance correction, optical channel ordering, normalization and kinetic assumptions.                                        |
| Is relative chlorophyll changing?                                     | Calibrated SPAD pair                                                    | Calibration, leaf thickness/species effects, wavelength pairing. Relative units are not universal pigment mass.                |

Use the source catalogue to inspect actual implementations before choosing parameter values. Papers establish the scientific method; firmware documents establish commands; raw records establish what the device actually returned.

## Method decisions that cannot be guessed from JSON

- Identify the experimental unit. Multiple leaves from one plant and repeated pulses on one leaf are not automatically independent plants.
- Specify leaf age/position, measurement location, sampling time, orientation, and handling. Avoid shadowing the ambient-light sensor with the operator or clip.
- Distinguish ambient matching from controlled illumination. A sun/shade treatment can refer to growth history, current sampling position, or chamber actinic light. Those answer different questions.
- State light or dark adaptation conditions and how steady state will be assessed. Do not insert a generic dark-adaptation time and claim it suits every species.
- Keep measuring pulses weak enough for the established method and verify the detector response. More brightness or pulse width changes the acquisition and may change physiology; it is not a free noise-reduction step.
- Establish that a claimed saturating pulse actually yields the required fluorescence maximum for the sample. A copied intensity and duration alone do not prove saturation.
- Prefer randomized or balanced sample order where appropriate. For a light series, explain whether its order is part of the method; randomization can alter adaptation history.
- Separate within-measurement averaging from independent replication. Averaging can suppress kinetics that are the actual outcome of interest.
- Retain treatment and QC flags alongside readings. Do not silently delete unusual physiology using a universal threshold.

## Phi2 worked reasoning example

The JII [Phi2 source](https://jan-ingenhousz-institute.github.io/JII-MultispeQ-Protocols/_modules/jii_multispeq_protocols/protocols/phi2.html#_analyze) pairs three phases, 20/50/20 cycles, with one detector. Its analysis uses zero-based half-open slices `[1:5]` for Fs and `[63:68]` for Fm′. These are properties of that particular pair, not reusable magic indices.

The unchanged pair has 90 expected detector values. Its pulse-train arithmetic is 90 × 10,000 µs = 900 ms, excluding overhead and clamp interaction. Phase boundaries are `[0,20)`, `[20,70)`, and `[70,90)`. The Fm′ window lies inside the middle phase. Reducing that phase from 50 to 20 makes the old Fm′ window out of bounds. Increasing the first phase shifts the saturation window. Either edit requires revisiting the macro.

For a synthetic trace with Fs = 100 and Fm′ = 400, Phi2 = 0.75 from `(Fm′ - Fs) / Fm′`. This checks arithmetic only. It does not establish saturation, the correct windows, or that a living sample behaves that way. Reject insufficient samples and zero/nonfinite denominators explicitly.

That source's LEF calculation multiplies Phi2 and PAR by 0.45. Treat 0.45 as the source method's assumption, record its meaning and applicability, and avoid presenting it as a universally calibrated conversion to electron flow or carbon fixation.

## Adapting a light series

Before editing a variable-driven baseline, write a table with repeat index, resolved actinic value, adaptation duration, acquisition block, and expected macro result row. Include the ambient placeholder as unresolved until measured. Preserve baseline gains and pulse settings initially. Change one scientific parameter, then compare original and modified raw traces and analysis outputs.

A request for 'faster' should first inspect waiting for the clamp, transport timeouts, and workflow overhead. Shortening dark relaxation, saturation, averaging, or pre-illumination changes the measurement. Report that tradeoff and propose a bench comparison instead of claiming equivalent physiology.
