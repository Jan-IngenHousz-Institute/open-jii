-- Current attached-AMBIT inventory: the latest change tuple per sensor.
--
-- What is on the port now (as far as the announcements say), for joining a trace
-- to its calibration. A trace references inventory by sensor_id +
-- protocol.cal_version, so join on those two when you need the calibration that
-- was actually in force for a measurement; use this view when you only need the
-- sensor's current state.
--
-- A row whose sensor_id is null is a genuine legacy exception (§8): it cannot be
-- joined to inventory, because the human `device` name is neither stable nor
-- unique.
CREATE OR REPLACE VIEW ${catalog}.${schema}.experiment_attached_sensors_latest
COMMENT 'Latest announced identity and calibration per attached AMBIT (mqtt-payload.md 10).'
AS
SELECT * EXCEPT (sensor_rank)
FROM (
  SELECT
    s.*,
    row_number() OVER (
      PARTITION BY s.experiment_id, s.sensor_id
      ORDER BY s.last_observed_utc DESC, s.source_row_id DESC
    ) AS sensor_rank
  FROM ${catalog}.${schema}.experiment_attached_sensors AS s
) AS ranked
WHERE sensor_rank = 1
