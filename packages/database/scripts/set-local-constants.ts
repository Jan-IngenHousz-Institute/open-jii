import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/database";
import { experiments } from "../src/schema";

// Local development constants for experiments
const LOCAL_DEV_SCHEMA_NAME = "exp_local_dev_001";
const LOCAL_DEV_PIPELINE_ID = "local-dev-pipeline-12345";

export default async function setLocalConstants() {
  console.log("Setting up local development constants for experiments...");

  try {
    // Create a trigger function that automatically sets local dev constants
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION set_local_experiment_constants()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Only set if values are null (don't override existing values)
        IF NEW.schema_name IS NULL THEN
          NEW.schema_name = '${sql.raw(LOCAL_DEV_SCHEMA_NAME)}';
        END IF;
        
        IF NEW.pipeline_id IS NULL THEN
          NEW.pipeline_id = '${sql.raw(LOCAL_DEV_PIPELINE_ID)}';
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create the trigger that fires before INSERT
    await db.execute(sql`
      DROP TRIGGER IF EXISTS experiment_local_constants_trigger ON experiments;
      CREATE TRIGGER experiment_local_constants_trigger
        BEFORE INSERT ON experiments
        FOR EACH ROW
        EXECUTE FUNCTION set_local_experiment_constants();
    `);

    console.log("Local development trigger created successfully!");
    console.log(`   New experiments will automatically get:`);
    console.log(`      - Schema Name: ${LOCAL_DEV_SCHEMA_NAME}`);
    console.log(`      - Pipeline ID: ${LOCAL_DEV_PIPELINE_ID}`);

    // Update existing experiments that don't have these values
    await db.execute(sql`
      UPDATE experiments 
      SET 
        schema_name = '${sql.raw(LOCAL_DEV_SCHEMA_NAME)}',
        pipeline_id = '${sql.raw(LOCAL_DEV_PIPELINE_ID)}'
      WHERE 
        schema_name IS NULL 
        OR pipeline_id IS NULL;
    `);

    console.log("Updated existing experiments with local constants");

    // Show current state of experiments
    const currentExperiments = await db
      .select({
        id: experiments.id,
        name: experiments.name,
        schemaName: experiments.schemaName,
        pipelineId: experiments.pipelineId,
        status: experiments.status,
      })
      .from(experiments)
      .orderBy(experiments.createdAt)
      .limit(5);

    if (currentExperiments.length > 0) {
      console.log("\nCurrent experiments:");
      currentExperiments.forEach((exp, i) => {
        console.log(`   ${i + 1}. ${exp.name} (${exp.status})`);
        console.log(`      Schema: ${exp.schemaName}`);
        console.log(`      Pipeline: ${exp.pipelineId}`);
      });
    }

    console.log("\nSetup complete! All new experiments will automatically get the local constants.");

  } catch (error) {
    console.error("Error setting up local constants:", error);
    throw error;
  }
}

// Auto-run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setLocalConstants().catch(console.error);
}