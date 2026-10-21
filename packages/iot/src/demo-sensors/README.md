# Demo sensor definitions

These synthetic placeholders let a demo workbook run without hardware. They are
not hardware recordings, calibration references, or protocols approved for use on
real sensors. OJD-2222 owns their replacement by the hardware team.

Each sensor folder contains:

- `protocol.json`: the protocol array sent through that sensor's existing driver.
- `recording.placeholder.json`: one sanitized measurement envelope.
- `macro.py`: a Python macro body, compatible with the sandbox and Android runner.
- `manifest.json`: placeholder provenance, protocol/recording versions, wire framing
  and expected macro outputs.

The database seed reads these files from this package. Simulated transports use
the same protocol and recording. Replace the files together when a real recording
arrives; keep the reserved `simulated:<family>` identity and remove hardware
addresses, serial numbers, locations and personal information. Update the manifest
with the real source firmware and protocol version, retain the simulated identity,
and update the expected outputs. Replay code should not need editing.

Macros receive the first element of `sample` through the platform's shared macro
input normalization. Each macro returns a dictionary. The MultispeQ example
calculates Phi2 from two synthetic fluorescence groups. Ambit summarizes its
630 nm signal and reference traces. MiniPAR summarizes three PAR values.

Validate the definitions with:

```sh
python3 packages/iot/src/demo-sensors/test_definitions.py
```

This runs the actual macro bodies with the same normalized input and dictionary
output convention as the Python sandbox. It also rejects identifying data in the
recordings. Driver-level replay tests belong to the simulated transport.
