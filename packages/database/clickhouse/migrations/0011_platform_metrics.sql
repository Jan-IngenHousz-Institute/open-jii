-- Every reading of each sensor the platform metrics count, out of a measurement's payload, as the
-- feed extracts them. Rows written before this hold none until measurements are reloaded.
ALTER TABLE measurements
    ADD COLUMN IF NOT EXISTS par_readings Array(Float64) AFTER output_data,
    ADD COLUMN IF NOT EXISTS temperature_readings Array(Float64) AFTER par_readings,
    ADD COLUMN IF NOT EXISTS humidity_readings Array(Float64) AFTER temperature_readings,
    ADD COLUMN IF NOT EXISTS pressure_readings Array(Float64) AFTER humidity_readings,
    ADD COLUMN IF NOT EXISTS light_intensity_readings Array(Float64) AFTER pressure_readings,
    ADD COLUMN IF NOT EXISTS thickness_readings Array(Float64) AFTER light_intensity_readings;

-- The platform metrics, recounted every hour from each row's newest commit. The metrics user is
-- granted these views and not the tables, so it reads figures, never rows. A measurement counts when
-- its clock was plausible: not before 2000, as an unset clock reads, and not in the future. A view
-- answers with its last refresh, and a refresh that fails keeps it.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_platform_totals
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY tuple()
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    measurement_totals.*,
    macro_totals.total_macro_executions,
    upload_totals.total_uploaded_rows,
    now64(6) AS computed_at
FROM
(
    SELECT
        count() AS total_measurements,
        -- The bytes of each payload's JSON as the store holds it.
        sum(length(ifNull(data, ''))) AS total_volume_bytes,
        uniqExact(device_id) AS devices_all_time,
        uniqExact(experiment_id) AS experiments_with_data,
        minOrNull(timestamp) AS first_measurement_at,
        maxOrNull(timestamp) AS last_measurement_at
    FROM measurements FINAL
    WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
) AS measurement_totals
CROSS JOIN
(
    SELECT count() AS total_macro_executions
    FROM macro_results FINAL
    WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
) AS macro_totals
CROSS JOIN (SELECT count() AS total_uploaded_rows FROM uploads FINAL) AS upload_totals;

-- Uploads count on the day they were uploaded. The feed writes an upload without that time as the
-- store's earliest, which no upload has, so those count in the totals and on no day.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily_activity
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY date
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    date,
    measurements,
    live_measurements,
    imported_measurements,
    active_devices,
    active_experiments,
    macro_executions,
    uploaded_rows,
    volume_bytes,
    sum(measurements) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_measurements,
    now64(6) AS computed_at
FROM
(
    SELECT
        date,
        sum(measurements) AS measurements,
        sum(live_measurements) AS live_measurements,
        sum(imported_measurements) AS imported_measurements,
        sum(active_devices) AS active_devices,
        sum(active_experiments) AS active_experiments,
        sum(macro_executions) AS macro_executions,
        sum(uploaded_rows) AS uploaded_rows,
        sum(volume_bytes) AS volume_bytes
    FROM
    (
        SELECT
            toDate(timestamp) AS date,
            count() AS measurements,
            -- Imported rows are the only ones that skip macro processing.
            countIf(NOT ifNull(skip_macro_processing, false)) AS live_measurements,
            countIf(ifNull(skip_macro_processing, false)) AS imported_measurements,
            uniqExact(device_id) AS active_devices,
            uniqExact(experiment_id) AS active_experiments,
            0 AS macro_executions,
            0 AS uploaded_rows,
            sum(length(ifNull(data, ''))) AS volume_bytes
        FROM measurements FINAL
        WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
        GROUP BY date

        UNION ALL

        SELECT toDate(timestamp) AS date, 0, 0, 0, 0, 0, count(), 0, 0
        FROM macro_results FINAL
        WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
        GROUP BY date

        UNION ALL

        SELECT toDate(uploaded_at) AS date, 0, 0, 0, 0, 0, 0, count(), 0
        FROM uploads FINAL
        WHERE uploaded_at > '1900-01-01 00:00:00'
        GROUP BY date
    )
    GROUP BY date
);

-- Per publisher rather than per device family: the backend names each client's family from the
-- device registry, as it names devices.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_client_totals
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY tuple()
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    client_id,
    count() AS total_measurements,
    max(timestamp) AS last_measurement_at,
    now64(6) AS computed_at
FROM measurements FINAL
WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
GROUP BY client_id;

-- A row without a zone, or with one the store does not know, such as PST or +02:00, has no local
-- hour here.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly_activity
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY hour_local
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    toUInt8(formatDateTime(timestamp, '%H', zone)) AS hour_local,
    count() AS measurements,
    now64(6) AS computed_at
FROM
(
    SELECT timestamp, assumeNotNull(timezone) AS zone
    FROM measurements FINAL
    WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
        AND timezone IN (SELECT time_zone FROM system.time_zones)
)
GROUP BY hour_local;

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_activity_windows
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY tuple()
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    countIf(timestamp >= now64(6) - INTERVAL 24 HOUR) AS measurements_24h,
    countIf(timestamp >= now64(6) - INTERVAL 7 DAY) AS measurements_7d,
    uniqExactIf(experiment_id, timestamp >= now64(6) - INTERVAL 7 DAY) AS experiments_7d,
    uniqExactIf(user_id, timestamp >= now64(6) - INTERVAL 7 DAY) AS contributors_7d,
    uniqExactIf(device_id, timestamp >= now64(6) - INTERVAL 7 DAY) AS devices_7d,
    countIf(timestamp >= now64(6) - INTERVAL 30 DAY) AS measurements_30d,
    uniqExactIf(experiment_id, timestamp >= now64(6) - INTERVAL 30 DAY) AS experiments_30d,
    uniqExactIf(user_id, timestamp >= now64(6) - INTERVAL 30 DAY) AS contributors_30d,
    uniqExactIf(device_id, timestamp >= now64(6) - INTERVAL 30 DAY) AS devices_30d,
    maxOrNull(timestamp) AS last_measurement_at,
    now64(6) AS computed_at
FROM measurements FINAL
WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6);

-- The median of each vetted parameter over 90 days, exact and of the lower middle value as Spark's
-- percentile_approx picks it. A macro wrote everything in its output, so those parameters are
-- derived; a sensor reading is one the device put in its own payload. A macro's value reads as a
-- number when it is one, a boolean or a number in text, as Spark's try_variant_get reads it.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_parameter_stats
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY (category, parameter)
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    parameter,
    label,
    category,
    count() AS observations,
    medianExactLow(value) AS median_value,
    now64(6) AS computed_at
FROM
(
    SELECT
        reading.1 AS parameter,
        reading.2 AS label,
        'derived' AS category,
        if(
            dynamicType(reading.3) = 'String',
            toFloat64OrNull(trimBoth(dynamicElement(reading.3, 'String'))),
            accurateCastOrNull(reading.3, 'Float64')
        ) AS value
    FROM macro_results FINAL
    ARRAY JOIN [
        ('Phi2', 'Photosystem II efficiency (Phi2)', macro_output.Phi2),
        ('PhiNPQ', 'Regulated heat dissipation (PhiNPQ)', macro_output.PhiNPQ),
        ('PhiNO', 'Unregulated dissipation (PhiNO)', macro_output.PhiNO),
        ('NPQt', 'Non-photochemical quenching (NPQt)', macro_output.NPQt),
        ('LEF', 'Linear electron flow (LEF)', macro_output.LEF),
        ('qL', 'Open reaction centres (qL)', macro_output.qL),
        ('qP', 'Photochemical quenching (qP)', macro_output.qP),
        ('RFd', 'Fluorescence decline ratio (RFd)', macro_output.RFd),
        ('SPAD', 'Relative chlorophyll (SPAD)', macro_output.SPAD),
        ('red_fraction', 'Red reflectance fraction', macro_output.red_fraction),
        ('green_fraction', 'Green reflectance fraction', macro_output.green_fraction),
        ('blue_fraction', 'Blue reflectance fraction', macro_output.blue_fraction),
        ('tilt_angle_deg', 'Leaf tilt angle (degrees)', macro_output.tilt_angle_deg),
        ('par_umol_m2_s', 'Light intensity, PAR (umol/m2/s)', macro_output.par_umol_m2_s),
        ('relative_humidity_pct', 'Relative humidity (%)', macro_output.relative_humidity_pct),
        ('air_temperature_c', 'Air temperature (C)', macro_output.air_temperature_c),
        ('contactless_temperature_c', 'Leaf temperature, contactless (C)', macro_output.contactless_temperature_c),
        ('pressure_hpa', 'Air pressure (hPa)', macro_output.pressure_hpa)
    ] AS reading
    WHERE timestamp >= now64(6) - INTERVAL 90 DAY AND timestamp >= '2000-01-01 00:00:00'
        AND timestamp <= now64(6)

    UNION ALL

    SELECT reading.1, reading.2, 'sensor', arrayJoin(reading.3)
    FROM measurements FINAL
    ARRAY JOIN [
        ('par', 'Light intensity, PAR', par_readings),
        ('temperature', 'Temperature', temperature_readings),
        ('humidity', 'Relative humidity', humidity_readings),
        ('pressure', 'Air pressure', pressure_readings),
        ('light_intensity', 'Light intensity', light_intensity_readings),
        ('thickness', 'Leaf thickness', thickness_readings)
    ] AS reading
    WHERE timestamp >= now64(6) - INTERVAL 90 DAY AND timestamp >= '2000-01-01 00:00:00'
        AND timestamp <= now64(6)
)
WHERE value IS NOT NULL
GROUP BY parameter, label, category;

-- Scalar facts for the landing page's rotating captions. Runs of days are found by subtracting each
-- day's place in order from the day, which is the same for every day of one unbroken run.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_pool_facts
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY tuple()
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    sessions.session_median_measurements,
    endurance.device_endurance_days,
    simultaneity.simultaneity_peak_devices,
    window_totals.timezones_all_time,
    day_runs.timezones_peak_day,
    window_totals.mean_arrival_gap_seconds,
    day_runs.current_streak_days,
    now64(6) AS computed_at
FROM
(
    SELECT medianExactLowOrNull(session_size) AS session_median_measurements
    FROM
    (
        SELECT count() AS session_size
        FROM measurements FINAL
        WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6) AND workbook_run_id IS NOT NULL
        GROUP BY workbook_run_id
    )
) AS sessions
CROSS JOIN
(
    SELECT maxOrNull(run_days) AS device_endurance_days
    FROM
    (
        SELECT count() AS run_days
        FROM
        (
            SELECT device_id, toUInt32(date) - row_number() OVER (PARTITION BY device_id ORDER BY date) AS run
            FROM
            (
                SELECT DISTINCT device_id, toDate(timestamp) AS date
                FROM measurements FINAL
                WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6) AND device_id IS NOT NULL
            )
        )
        GROUP BY device_id, run
    )
) AS endurance
CROSS JOIN
(
    SELECT maxOrNull(devices) AS simultaneity_peak_devices
    FROM
    (
        SELECT uniqExact(device_id) AS devices
        FROM measurements FINAL
        WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
            AND timestamp >= now64(6) - INTERVAL 30 DAY AND device_id IS NOT NULL
        GROUP BY toStartOfMinute(timestamp)
    )
) AS simultaneity
CROSS JOIN
(
    SELECT
        uniqExact(timezone) AS timezones_all_time,
        -- Across the span the 30 days' measurements cover, which N of them divide into N - 1 gaps.
        if(
            countIf(in_window) > 1,
            (toUnixTimestamp64Micro(maxIf(timestamp, in_window)) / 1000000
                - toUnixTimestamp64Micro(minIf(timestamp, in_window)) / 1000000)
                / (countIf(in_window) - 1),
            NULL
        ) AS mean_arrival_gap_seconds
    FROM
    (
        SELECT timezone, timestamp, timestamp >= now64(6) - INTERVAL 30 DAY AS in_window
        FROM measurements FINAL
        WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
    )
) AS window_totals
CROSS JOIN
(
    -- A run that ended today or yesterday is the current streak; runs are maximal, so at most one does.
    SELECT
        maxIf(run_days, dateDiff('day', run_end, toDate(now64(6, 'UTC'))) <= 1) AS current_streak_days,
        maxOrNullIf(zones, zones > 0) AS timezones_peak_day
    FROM
    (
        SELECT count() AS run_days, max(date) AS run_end, max(zones) AS zones
        FROM
        (
            SELECT date, zones, toUInt32(date) - row_number() OVER (ORDER BY date) AS run
            FROM
            (
                SELECT toDate(timestamp) AS date, uniqExact(timezone) AS zones
                FROM measurements FINAL
                WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
                GROUP BY date
            )
        )
        GROUP BY run
    )
) AS day_runs;

-- The backend's own inputs for an organisation's or a user's activity, at experiment and contributor
-- grain, which it aggregates before anything leaves it.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily_activity_by_experiment
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY (date, experiment_id)
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    toDate(timestamp) AS date,
    experiment_id,
    count() AS measurements,
    uniqExact(device_id) AS active_devices,
    now64(6) AS computed_at
FROM measurements FINAL
WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
GROUP BY date, experiment_id;

-- Workbooks by version, which is what a measurement records; the backend resolves the workbook.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_daily_activity_by_resource
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY (resource_type, date)
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT date, resource_type, resource_id, measurements, now64(6) AS computed_at
FROM
(
    SELECT
        toDate(timestamp) AS date,
        resource.1 AS resource_type,
        assumeNotNull(resource.2) AS resource_id,
        count() AS measurements
    FROM measurements FINAL
    ARRAY JOIN [('protocol', protocol_id), ('workbook_version', workbook_version_id)] AS resource
    WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6) AND resource.2 IS NOT NULL
    GROUP BY date, resource_type, resource_id

    UNION ALL

    SELECT toDate(timestamp) AS date, 'macro', assumeNotNull(macro_id), count()
    FROM macro_results FINAL
    WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6) AND macro_id IS NOT NULL
    GROUP BY date, macro_id
);

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_experiment_contributors_window
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY tuple()
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT experiment_id, user_id, now64(6) AS computed_at
FROM measurements FINAL
WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
    AND timestamp >= now64(6) - INTERVAL 30 DAY AND user_id IS NOT NULL
GROUP BY experiment_id, user_id;

-- Publishers as they named themselves, registered or not: a logger publishes with no contributor.
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_experiment_devices_window
REFRESH EVERY 1 HOUR
ENGINE = MergeTree ORDER BY tuple()
DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT experiment_id, client_id, now64(6) AS computed_at
FROM measurements FINAL
WHERE timestamp >= '2000-01-01 00:00:00' AND timestamp <= now64(6)
    AND timestamp >= now64(6) - INTERVAL 30 DAY AND client_id IS NOT NULL
GROUP BY experiment_id, client_id;
