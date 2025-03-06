# Adding Annotations in Databricks

This guide explains how to add and update annotations to experiment data through the Databricks UI, focusing on complex data types like maps, arrays, and structs that are used in experimental metadata tables.

## Introduction

The OpenJII platform uses rich data structures to store experiment annotations, including:

- Key-value maps for custom annotations
- Structured observations with multiple fields
- Arrays of structured data for time-series observations
- Tracking changes to annotations over time

These complex data structures require specific approaches when adding or modifying them through the Databricks UI.

## Prerequisites

- Access to the Databricks workspace
- Appropriate permissions to the experiment schema and tables
- Basic familiarity with SQL and JSON structures

## Methods for Adding Annotations

### Method 1: Using Data Explorer

1. Navigate to the **Data Explorer** in your Databricks workspace
2. Browse to your catalog (e.g., `open_jii_dev`), schema (e.g., `exp_amsterdam_2023_tulips`), and table (e.g., `plant_metadata`)
3. Click on **View data** to see existing records
4. For simple fields, you can directly edit cells in the table view

![Data Explorer Navigation](../assets/images/databricks-data-explorer.png)

### Method 2: Using SQL Editor for Complex Types

For complex types like maps, arrays, and structs, you'll need to use SQL:

1. Open a **SQL Notebook** or the **SQL Editor**
2. Use the appropriate SQL syntax for your data type

#### Adding Map Data (custom_annotations)

```sql
-- Update custom annotations for a specific plant
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET custom_annotations = MAP('soil_ph', '7.2', 'light_exposure', 'partial', 'watering_schedule', 'daily')
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';

-- Add a single key-value pair to existing annotations
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET custom_annotations = MAP_CONCAT(
    custom_annotations,
    MAP('fertilizer_applied', 'yes')
)
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';
```

#### Adding Struct Data (phenotypic_observations)

```sql
-- Update phenotypic observations
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET phenotypic_observations = NAMED_STRUCT(
    'observation_date', CAST('2023-06-15' AS DATE),
    'height', 42.5,
    'leaf_count', 8,
    'color', 'vibrant green',
    'additional_notes', 'Showing excellent growth pattern'
)
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';
```

#### Adding Array Data (image_references)

```sql
-- Update image references array
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET image_references = ARRAY(
    NAMED_STRUCT(
        'image_date', CAST('2023-06-10' AS DATE),
        'image_url', 's3://openjii-images/plant001/img001.jpg',
        'image_type', 'visible light',
        'notes', 'Baseline image'
    ),
    NAMED_STRUCT(
        'image_date', CAST('2023-06-17' AS DATE),
        'image_url', 's3://openjii-images/plant001/img002.jpg',
        'image_type', 'infrared',
        'notes', 'One week growth'
    )
)
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';

-- Add a new image to existing array
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET image_references = ARRAY_APPEND(
    image_references,
    NAMED_STRUCT(
        'image_date', CAST('2023-06-24' AS DATE),
        'image_url', 's3://openjii-images/plant001/img003.jpg',
        'image_type', 'visible light',
        'notes', 'Two week growth'
    )
)
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';
```

#### Tracking Annotation History

```sql
-- Record a change to the annotation history
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET
    annotation_history = ARRAY_APPEND(
        annotation_history,
        NAMED_STRUCT(
            'timestamp', CURRENT_TIMESTAMP(),
            'field', 'health_status',
            'old_value', 'healthy',
            'new_value', 'stress observed',
            'updated_by', current_user()
        )
    ),
    health_status = 'stress observed',
    last_updated = CURRENT_TIMESTAMP(),
    updated_by = current_user()
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';
```

### Method 3: Using Databricks Notebooks with Python

For more complex data manipulation, you can use Python in a notebook:

```python
# Connect to the table
plant_df = spark.table("open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata")

# Import required libraries
from pyspark.sql.functions import col, struct, array, map, lit, current_timestamp, current_user

# Create a complex update
from pyspark.sql.types import StringType, DoubleType
plant_df.createOrReplaceTempView("plant_temp")

# Example of updating with complex types
spark.sql("""
UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
SET
  custom_annotations = map('soil_moisture', '42%', 'light_intensity', '7500lux'),
  environmental_conditions = map('temperature', 23.5, 'humidity', 65.0, 'co2_level', 410.0),
  last_updated = current_timestamp(),
  updated_by = current_user()
WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001'
""")
```

## Best Practices

1. **Use Transactions**: For complex updates, wrap your SQL in a transaction to ensure consistency:

   ```sql
   BEGIN TRANSACTION;
   -- Your update statements here
   COMMIT;
   ```

2. **Always Update History**: When modifying important fields, update the annotation history to maintain an audit trail

3. **Validate Data Types**: Ensure your input values match the expected data types (especially for maps and arrays)

4. **Use Helper Functions**: Consider creating reusable SQL functions or Python utilities for common annotation tasks

5. **Batch Updates**: For bulk updates to multiple plants, consider using a CSV import approach with transformation logic

## Automated Annotation with Workflows

For regular or systematic annotations, consider using Databricks Workflows:

1. Create a notebook with annotation logic
2. Schedule it as a workflow job
3. Configure parameters like experiment_id, date ranges, etc.

This approach works well for automated annotations like growth stage transitions or scheduled observations.

## Troubleshooting

If you encounter errors with complex data types:

1. Check the exact syntax required for your Databricks runtime version
2. Test your updates on a small subset of data first
3. Verify data types match exactly (e.g., integers vs. doubles)
4. For map keys, ensure consistency in naming conventions

## Example Workflow: Complete Plant Annotation

The following workflow demonstrates a complete plant annotation process:

1. **Create initial plant record**:

   ```sql
   INSERT INTO open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
   VALUES (
     'PLANT-001', -- plant_id
     'EXP-2023-001', -- experiment_id
     'Tulipa gesneriana', -- species
     'Apeldoorn Elite', -- variety
     CAST('2023-04-15' AS DATE), -- planting_date
     'Treatment Group A', -- treatment_group
     'Row 3, Position 12', -- location_in_experiment
     'seedling', -- growth_stage
     'healthy', -- health_status
     'Initial planting notes', -- notes
     'standard genotype', -- plant_genotype
     MAP('soil_type', 'peat moss mix'), -- custom_annotations
     NAMED_STRUCT(
       'observation_date', CAST('2023-04-15' AS DATE),
       'height', 0.0,
       'leaf_count', 0,
       'color', 'n/a',
       'additional_notes', 'Just planted'
     ), -- phenotypic_observations
     MAP('temperature', 21.0, 'humidity', 60.0), -- environmental_conditions
     ARRAY(), -- image_references (empty initially)
     NULL, -- experimental_results (none yet)
     CURRENT_TIMESTAMP(), -- last_updated
     current_user(), -- updated_by
     ARRAY(
       NAMED_STRUCT(
         'timestamp', CURRENT_TIMESTAMP(),
         'field', 'initial_record',
         'old_value', '',
         'new_value', 'created',
         'updated_by', current_user()
       )
     ) -- annotation_history
   );
   ```

2. **Update with new observations**:

   ```sql
   -- After two weeks, update observations
   UPDATE open_jii_dev.exp_amsterdam_2023_tulips.plant_metadata
   SET
     growth_stage = 'vegetative',
     phenotypic_observations = NAMED_STRUCT(
       'observation_date', CAST('2023-04-29' AS DATE),
       'height', 15.2,
       'leaf_count', 4,
       'color', 'medium green',
       'additional_notes', 'Healthy development observed'
     ),
     image_references = ARRAY(
       NAMED_STRUCT(
         'image_date', CAST('2023-04-29' AS DATE),
         'image_url', 's3://openjii-images/EXP-2023-001/PLANT-001/week2.jpg',
         'image_type', 'RGB',
         'notes', 'Two week growth image'
       )
     ),
     last_updated = CURRENT_TIMESTAMP(),
     updated_by = current_user(),
     annotation_history = ARRAY_APPEND(
       annotation_history,
       NAMED_STRUCT(
         'timestamp', CURRENT_TIMESTAMP(),
         'field', 'growth_stage',
         'old_value', 'seedling',
         'new_value', 'vegetative',
         'updated_by', current_user()
       )
     )
   WHERE plant_id = 'PLANT-001' AND experiment_id = 'EXP-2023-001';
   ```

By following these guidelines, you can effectively manage complex annotations for your plant experiments in the OpenJII platform.
