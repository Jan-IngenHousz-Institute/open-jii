-- Custom data migration: convert experiment flows into workbooks + versions.
--
-- For each experiment that has a flow record but no workbook:
--   1. Traverse the flow graph edges from the start node to order nodes
--   2. Convert ordered nodes to workbook cell JSON
--   3. Create a workbook named "{experiment.name} - Workbook"
--   4. Create workbook version 1 with those cells
--   5. Link experiment to workbook + version
--
-- Idempotent: skips experiments that already have a workbook_id.

DO $$
DECLARE
  rec RECORD;
  v_cells jsonb;
  v_workbook_id uuid;
  v_version_id uuid;
BEGIN
  FOR rec IN
    SELECT
      e.id          AS experiment_id,
      e.name        AS experiment_name,
      e.created_by,
      f.graph
    FROM experiments e
    INNER JOIN flows f ON f.experiment_id = e.id
    WHERE e.workbook_id IS NULL
      AND f.graph IS NOT NULL
      AND jsonb_array_length(COALESCE(f.graph->'nodes', '[]'::jsonb)) > 0
  LOOP
    -- 1. Order nodes by walking edges from the start node
    WITH RECURSIVE
    start_node AS (
      SELECT n.value AS node
      FROM jsonb_array_elements(rec.graph->'nodes') AS n(value)
      WHERE (n.value->>'isStart')::boolean IS TRUE
      LIMIT 1
    ),
    fallback_start AS (
      -- If no node has isStart=true, pick the first node
      SELECT COALESCE(
        (SELECT node FROM start_node),
        (SELECT value FROM jsonb_array_elements(rec.graph->'nodes') LIMIT 1)
      ) AS node
    ),
    walk(node_id, node_value, depth, visited) AS (
      SELECT
        fs.node->>'id',
        fs.node,
        0,
        ARRAY[fs.node->>'id']
      FROM fallback_start fs

      UNION ALL

      SELECT
        target_node.value->>'id',
        target_node.value,
        w.depth + 1,
        w.visited || (target_node.value->>'id')
      FROM walk w
      -- Find edges from current node
      CROSS JOIN LATERAL (
        SELECT e.value->>'target' AS target_id
        FROM jsonb_array_elements(rec.graph->'edges') AS e(value)
        WHERE e.value->>'source' = w.node_id
        LIMIT 1
      ) edge
      -- Resolve target node
      CROSS JOIN LATERAL (
        SELECT n.value
        FROM jsonb_array_elements(rec.graph->'nodes') AS n(value)
        WHERE n.value->>'id' = edge.target_id
      ) target_node
      WHERE w.depth < 100
        AND NOT (target_node.value->>'id' = ANY(w.visited))
    ),
    ordered_nodes AS (
      SELECT node_id, node_value, depth
      FROM walk
      ORDER BY depth
    ),

    -- 2. Convert each node to a workbook cell
    cells AS (
      SELECT
        depth,
        CASE (node_value->>'type')
          -- measurement to protocol cell
          WHEN 'measurement' THEN jsonb_build_object(
            'id', node_value->>'id',
            'type', 'protocol',
            'isCollapsed', false,
            'payload', jsonb_build_object(
              'protocolId', node_value->'content'->>'protocolId',
              'version', 1,
              'name', node_value->>'name'
            )
          )
          -- analysis to macro cell
          WHEN 'analysis' THEN jsonb_build_object(
            'id', node_value->>'id',
            'type', 'macro',
            'isCollapsed', false,
            'payload', jsonb_build_object(
              'macroId', node_value->'content'->>'macroId',
              'language', 'javascript',
              'name', node_value->>'name'
            )
          )
          -- question to question cell (content IS the question object)
          WHEN 'question' THEN jsonb_build_object(
            'id', node_value->>'id',
            'type', 'question',
            'isCollapsed', false,
            'isAnswered', false,
            'question', node_value->'content'
          )
          -- instruction to markdown cell
          WHEN 'instruction' THEN jsonb_build_object(
            'id', node_value->>'id',
            'type', 'markdown',
            'isCollapsed', false,
            'content', COALESCE(node_value->'content'->>'text', '')
          )
        END AS cell
      FROM ordered_nodes
      ORDER BY depth
    ),
    cell_array AS (
      SELECT COALESCE(jsonb_agg(cell ORDER BY depth), '[]'::jsonb) AS cells
      FROM cells
      WHERE cell IS NOT NULL
    )
    SELECT cells INTO v_cells FROM cell_array;

    -- Skip if no convertible cells
    IF v_cells IS NULL OR jsonb_array_length(v_cells) = 0 THEN
      CONTINUE;
    END IF;

    -- 3. Create workbook
    INSERT INTO workbooks (name, description, cells, metadata, created_by)
    VALUES (
      rec.experiment_name || ' - Workbook',
      'Auto-migrated from experiment flow',
      v_cells,
      '{}'::jsonb,
      rec.created_by
    )
    RETURNING id INTO v_workbook_id;

    -- 4. Create version 1
    INSERT INTO workbook_versions (workbook_id, version, cells, metadata, created_by)
    VALUES (
      v_workbook_id,
      1,
      v_cells,
      '{}'::jsonb,
      rec.created_by
    )
    RETURNING id INTO v_version_id;

    -- 5. Link experiment
    UPDATE experiments
    SET workbook_id = v_workbook_id,
        workbook_version_id = v_version_id
    WHERE id = rec.experiment_id;

    RAISE NOTICE 'Migrated "%" to workbook % (% cells)',
      rec.experiment_name, v_workbook_id, jsonb_array_length(v_cells);
  END LOOP;
END $$;