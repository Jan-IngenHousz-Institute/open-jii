-- Example entities for the study metadata ticket screens. Run against the scaffold's own database
-- after `db:seed`, never against a shared one. The overview renders on the server, so browser
-- fixtures cannot reach it and the example has to exist in the database.
UPDATE experiments
SET name = 'Drought trial (example data)',
    description = 'Soybean lines under three irrigation treatments, measured weekly through the season.',
    start_date = '2026-05-04',
    end_date = '2026-09-25',
    organism = 'Glycine max',
    growth_facility = 'Open field',
    experimental_design = 'Randomized complete blocks, three treatments in three blocks',
    license = 'CC-BY-4.0'
WHERE name = '[Seed] Soybean Drought Response Study';

-- The app lists every experiment by name, and no fixture hides test prefixes there.
UPDATE experiments
SET name = 'Second drought trial (example data)',
    description = 'Soybean lines under two irrigation treatments in a second field, measured weekly.'
WHERE name = '[Seed] Golden Standard Trial';
UPDATE experiments SET name = 'Draft trial (example data)' WHERE name = '[Seed] Sparse Draft Trial';
UPDATE experiments SET name = regexp_replace(name, '^\[Seed\] ', '') WHERE name LIKE '[Seed] %';
UPDATE experiments SET name = 'Corn photosynthesis field trial' WHERE name LIKE 'Field Trial 2025%';
UPDATE experiments SET name = 'Soil health monitoring' WHERE name LIKE 'Soil Health Monitoring%';
