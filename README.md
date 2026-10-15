# Payload visualization screenshots

Captured on 2026-10-16 using real workbook output and Plotly components at commit ccc1acbc660926eaa55fe532aadc7f4533bf1177. These are local component replays of saved measurement values.

- donghee-multispeq.png: saved DONGHEE H-O-H 2 workbook output, all 12,802 detector readings, protocol family Generic.
- ambit-measurement.png: complete measured MPF trace with 180 fluorescence/reference pairs and four temperature readings. Selected for a clear saturating-flash response from the large Ambit field dataset. Signal values range from 404 to 1157; every point and original relative timestamp is retained.
- ambit-qe.png: complete measured qE_dark_a trace with 390 fluorescence/reference pairs and 12 temperature readings.

Ambit identifiers, location and absolute timestamps were removed from the replay fixture. Ratios use the actual paired readings; no smoothing or curve fabrication is applied. The images are PR evidence. This branch is not intended for merging.
