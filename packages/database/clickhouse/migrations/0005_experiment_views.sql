-- One experiment's rows of each table, each row once at its newest commit. The backend's reader is
-- granted these views and not the tables, so it cannot read experiment data without naming an
-- experiment. FINAL belongs inside: written after a view's name it folds nothing. The views run with
-- the rights of whoever applied this file.
CREATE VIEW IF NOT EXISTS experiment_measurements DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM measurements FINAL WHERE experiment_id = {experiment:String};

CREATE VIEW IF NOT EXISTS experiment_macro_results DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM macro_results FINAL WHERE experiment_id = {experiment:String};

CREATE VIEW IF NOT EXISTS experiment_uploads DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM uploads FINAL WHERE experiment_id = {experiment:String};
