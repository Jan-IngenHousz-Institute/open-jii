-- One experiment's rows of each table. The backend's reader is granted these views and not the
-- tables, so it cannot read experiment data without naming an experiment. The views run with the
-- rights of whoever applied this file.
CREATE VIEW IF NOT EXISTS experiment_measurements DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM measurements WHERE experiment_id = {experiment:String};

CREATE VIEW IF NOT EXISTS experiment_macro_results DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM macro_results WHERE experiment_id = {experiment:String};

CREATE VIEW IF NOT EXISTS experiment_uploads DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM uploads WHERE experiment_id = {experiment:String};
