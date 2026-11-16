-- Every reading of each sensor the platform metrics count, out of a measurement's payload, as the
-- feed extracts them. Rows written before this hold none until measurements are reloaded.
ALTER TABLE measurements
    ADD COLUMN IF NOT EXISTS par_readings Array(Float64) AFTER output_data,
    ADD COLUMN IF NOT EXISTS temperature_readings Array(Float64) AFTER par_readings,
    ADD COLUMN IF NOT EXISTS humidity_readings Array(Float64) AFTER temperature_readings,
    ADD COLUMN IF NOT EXISTS pressure_readings Array(Float64) AFTER humidity_readings,
    ADD COLUMN IF NOT EXISTS light_intensity_readings Array(Float64) AFTER pressure_readings,
    ADD COLUMN IF NOT EXISTS thickness_readings Array(Float64) AFTER light_intensity_readings;
