-- The contributors and clients each experiment's rows name, as ids, so the backend can order a page
-- by a contributor's or device's name from Postgres without reading the experiment's rows for them.
-- Views add an insert's ids as it lands, and the tables fold repeats, so a replayed insert changes
-- nothing. Views never remove an id, so a reload removes the ones its deletes leave without rows.
CREATE TABLE IF NOT EXISTS contributor_ids
(
    experiment_id String,
    user_id String
)
ENGINE = ReplacingMergeTree
ORDER BY (experiment_id, user_id);

CREATE TABLE IF NOT EXISTS client_ids
(
    experiment_id String,
    client_id String
)
ENGINE = ReplacingMergeTree
ORDER BY (experiment_id, client_id);

-- A view's WHERE names the table's column in full: bare, it would name the alias, which is never
-- null, and a row without an id would add an empty one.
CREATE MATERIALIZED VIEW IF NOT EXISTS measurement_contributor_ids TO contributor_ids AS
SELECT experiment_id, assumeNotNull(user_id) AS user_id FROM measurements
WHERE measurements.user_id IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS macro_result_contributor_ids TO contributor_ids AS
SELECT experiment_id, assumeNotNull(user_id) AS user_id FROM macro_results
WHERE macro_results.user_id IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS upload_contributor_ids TO contributor_ids AS
SELECT experiment_id, assumeNotNull(created_by) AS user_id FROM uploads
WHERE uploads.created_by IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS measurement_client_ids TO client_ids AS
SELECT experiment_id, assumeNotNull(client_id) AS client_id FROM measurements
WHERE measurements.client_id IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS macro_result_client_ids TO client_ids AS
SELECT experiment_id, assumeNotNull(client_id) AS client_id FROM macro_results
WHERE macro_results.client_id IS NOT NULL;

-- The rows already stored, after the views, so nothing inserted meanwhile is missed.
INSERT INTO contributor_ids
SELECT DISTINCT experiment_id, assumeNotNull(user_id) FROM measurements WHERE user_id IS NOT NULL;

INSERT INTO contributor_ids
SELECT DISTINCT experiment_id, assumeNotNull(user_id) FROM macro_results WHERE user_id IS NOT NULL;

INSERT INTO contributor_ids
SELECT DISTINCT experiment_id, assumeNotNull(created_by) FROM uploads WHERE created_by IS NOT NULL;

INSERT INTO client_ids
SELECT DISTINCT experiment_id, assumeNotNull(client_id) FROM measurements WHERE client_id IS NOT NULL;

INSERT INTO client_ids
SELECT DISTINCT experiment_id, assumeNotNull(client_id) FROM macro_results WHERE client_id IS NOT NULL;

CREATE VIEW IF NOT EXISTS experiment_contributor_ids DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT DISTINCT user_id FROM contributor_ids WHERE experiment_id = {experiment:String};

CREATE VIEW IF NOT EXISTS experiment_client_ids DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT DISTINCT client_id FROM client_ids WHERE experiment_id = {experiment:String};
