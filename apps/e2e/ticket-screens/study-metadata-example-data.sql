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
    experimental_design = 'Randomized complete blocks, three treatments in four blocks',
    license = 'CC-BY-4.0'
WHERE name = '[Seed] Soybean Drought Response Study';
