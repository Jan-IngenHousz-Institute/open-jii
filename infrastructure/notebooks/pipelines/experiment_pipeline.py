# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline
# Implementation of experiment-specific medallion architecture pipeline
# Processes data from central silver layer into experiment-specific bronze/silver/gold tables

%pip install mini-racer numpy scipy

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, TimestampType, DoubleType, StructType, StructField, IntegerType, FloatType, BooleanType, ArrayType
from pyspark.sql import SparkSession
from delta.tables import DeltaTable
import os
import json
import sys
from typing import Dict, Any, List

sys.path.append("/Workspace/Shared/lib")
# Import the ambyte processing utilities
from ambyte_parsing import find_byte_folders, load_files_per_byte, process_trace_files
# Import volume I/O utilities
from volume_io import discover_and_validate_upload_directories, parse_upload_time

sys.path.append("/Workspace/Shared/notebooks/lib/multispeq/macro")
# Import our macro processing library
from macro import execute_macro_script, get_available_macros, process_macro_output_for_spark

sys.path.append("/Workspace/Shared/notebooks/lib/ambyte")
# Import the FMP2 calculation module
from fmp2 import apply_fmp2_calculations

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
# Runtime configuration parameters
EXPERIMENT_ID = spark.conf.get("EXPERIMENT_ID", "")  # Experiment identifier
EXPERIMENT_SCHEMA = spark.conf.get("EXPERIMENT_SCHEMA", "")  # Target schema for output
CATALOG_NAME = spark.conf.get("CATALOG_NAME", "open_jii_dev")
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA", "centrum")
CENTRAL_SILVER_TABLE = spark.conf.get("CENTRAL_SILVER_TABLE", "clean_data")

# Constants for ambyte processing
YEAR_PREFIX = "2025"

# Macro processing configuration
MACROS_PATH = "/Workspace/Shared/macros"  # Path to macro scripts
ENABLE_MACRO_PROCESSING = spark.conf.get("ENABLE_MACRO_PROCESSING", "true").lower() == "true"

# Output table names
DEVICE_TABLE = "device"
SAMPLE_TABLE = "sample"
RAW_AMBYTE_TABLE = "raw_ambyte_data"

spark = SparkSession.builder.getOrCreate()

print(f"Processing experiment: {EXPERIMENT_ID}")
print(f"Using experiment schema: {EXPERIMENT_SCHEMA}")
print(f"Reading from central schema: {CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
print(f"Macro processing enabled: {ENABLE_MACRO_PROCESSING}")
if ENABLE_MACRO_PROCESSING:
    print(f"Macros path: {MACROS_PATH}")

# COMMAND ----------

# DBTITLE 1,Device Table
@dlt.table(
    name=DEVICE_TABLE,
    comment="Device metadata from MultispeQ measurements",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true"
    }
)
def device():
    """Extract device metadata from central silver table filtered for MultispeQ data"""
    return (
        spark.read.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)  # Filter for specific experiment
        .select(
            F.col("device_name"),
            F.col("device_version"),
            F.col("device_id"),
            F.col("device_battery"),
            F.col("device_firmware"),
            F.current_timestamp().alias("processed_timestamp")
        )
        .dropDuplicates(["device_id", "device_firmware"])
    )

# COMMAND ----------

# DBTITLE 1,Sample Table (Core Table)
@dlt.table(
    name=SAMPLE_TABLE,
    comment="Core sample table containing references to measurement sets",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
def sample():
    """Extract sample metadata and create references to measurement sets from central silver table"""
    base_df = (
        spark.read.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)  # Filter for specific experiment
    )
    
    # Get user_answers columns from the central table (they're already extracted there)
    # Legacy feature - these columns will eventually be removed
    user_answers_df = (
        base_df
        .select(
            F.col("device_id"),
            F.col("plot_number"),
            F.col("plant"),
            F.col("stem_count"),
            F.col("timestamp")
        )
        .dropDuplicates(["device_id", "timestamp"])
    )
    
    # Process sample data as before
    sample_df = (
        base_df
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.explode(F.from_json(F.col("sample"), "array<string>")).alias("sample_data_str")
        )
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.get_json_object(F.col("sample_data_str"), "$.v_arrays").alias("v_arrays"),
            F.get_json_object(F.col("sample_data_str"), "$.set_repeats").cast("int").alias("set_repeats"),
            F.get_json_object(F.col("sample_data_str"), "$.protocol_id").alias("protocol_id"),
            F.get_json_object(F.col("sample_data_str"), "$.macros").alias("macros"),
            F.when(F.get_json_object(F.col("sample_data_str"), "$.set").isNotNull(), 
                   F.from_json(F.get_json_object(F.col("sample_data_str"), "$.set"), "array<string>"))
            .otherwise(
                # Extract all fields except v_arrays, set_repeats, and protocol_id as JSON strings
                F.expr("""
                    transform(
                        filter(
                            map_keys(from_json(sample_data_str, 'map<string,string>')),
                            key -> key NOT IN ('v_arrays', 'set_repeats', 'protocol_id')
                        ),
                        key -> to_json(map(key, get_json_object(sample_data_str, concat('$.', key))))
                    )
                """)
            ).alias("measurement_sets"),
            F.abs(
                F.hash(
                    F.lit(EXPERIMENT_ID),
                    F.col("device_id"),
                    F.col("sample_data_str")
                )
            ).alias("sample_id"),
            F.current_timestamp().alias("processed_timestamp")
        )
        .withColumn("measurement_set_types", 
            F.when(F.col("measurement_sets").isNotNull(),
                   F.when(F.expr("size(filter(transform(measurement_sets, x -> get_json_object(x, '$.label')), label -> label is not null)) > 0"),
                          F.expr("transform(measurement_sets, x -> get_json_object(x, '$.label'))"))
                   .otherwise(F.lit(None)))
            .otherwise(F.array())
        )
    )
    
    # Join with user_answers to add the user response columns
    return (
        sample_df
        .join(
            user_answers_df,
            on=["device_id", "timestamp"],
            how="left"
        )
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.col("v_arrays"),
            F.col("set_repeats"),
            F.col("protocol_id"),
            F.col("macros"),
            F.col("measurement_sets"),
            F.col("measurement_set_types"),
            F.col("sample_id"),
            F.col("plot_number"),
            F.col("plant"),
            F.col("stem_count"),
            F.col("processed_timestamp")
        )
    )

# COMMAND ----------

# DBTITLE 1,Raw Ambyte Data Table Schema
# Define the schema for the raw ambyte data table
raw_ambyte_schema = StructType([
    StructField("Time", TimestampType(), False),
    StructField("SigF", IntegerType(), True),
    StructField("RefF", IntegerType(), True),
    StructField("Sun", IntegerType(), True),
    StructField("Leaf", IntegerType(), True),
    StructField("Sig7", IntegerType(), True),
    StructField("Ref7", IntegerType(), True),
    StructField("Actinic", IntegerType(), True),
    StructField("Temp", FloatType(), True),
    StructField("Res", IntegerType(), True),
    StructField("Full", BooleanType(), True),
    StructField("Type", StringType(), True),
    StructField("Count", IntegerType(), True),
    StructField("PTS", IntegerType(), True),
    StructField("PAR", FloatType(), True),
    StructField("raw", FloatType(), True),
    StructField("spec", ArrayType(IntegerType()), True),
    StructField("BoardT", FloatType(), True),
    StructField("ambyte_folder", StringType(), True),
    StructField("ambit_index", IntegerType(), True),
    StructField("meta_Actinic", FloatType(), True),
    StructField("meta_Dark", IntegerType(), True),
    StructField("upload_directory", StringType(), True),
    StructField("upload_time", TimestampType(), True)
])

# COMMAND ----------

# DBTITLE 1,Raw Ambyte Data Table
@dlt.table(
    name=RAW_AMBYTE_TABLE,
    comment="ambyte trace data processed from raw files stored in Databricks volume"
)
def raw_ambyte_data():
    """
    Main DLT table-generating function that processes Ambyte trace files from a Databricks volume
    and creates a Delta table with the processed data.
    """
    # Configuration - specify the base path in the Databricks volume
    # This should be configured based on your actual volume mount point
    ambyte_base_path = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads/ambyte"
    
    # Find all upload directories with the format upload_YYYYMMDD_SS
    upload_directories, success = discover_and_validate_upload_directories(ambyte_base_path)
    
    if not success or not upload_directories:
        # Return an empty dataframe with the correct schema if no upload directories are found
        return spark.createDataFrame([], schema=raw_ambyte_schema)
    
    # Process each upload directory
    all_data = []
    
    for upload_dir in upload_directories:
        upload_dir_name = os.path.basename(upload_dir)
        print(f"Processing upload directory: {upload_dir_name}")
        
        # Parse upload time from directory name
        upload_time = parse_upload_time(upload_dir_name)
        
        # Find all Ambyte_N and unknown_ambyte folders within this upload directory
        # Each of these folders should contain either 1-4 subfolders or unknown_ambit subfolder
        try:
            # Use the existing find_byte_folders function to discover valid byte parent folders
            byte_parent_folders = find_byte_folders(upload_dir)
            
            if byte_parent_folders:
                print(f"Found {len(byte_parent_folders)} valid byte parent folders in {upload_dir_name}")
                print(f"Byte parent folders: {[os.path.basename(x.rstrip('/')) for x in byte_parent_folders]}")
            else:
                print(f"No valid byte parent folders found in {upload_dir_name}")
                continue
                
        except Exception as e:
            print(f"Error finding byte folders in {upload_dir_name}: {e}")
            continue
        
        # Process each byte folder within this upload directory
        for ambyte_folder in byte_parent_folders:
            ambyte_folder_name = os.path.basename(ambyte_folder.rstrip('/'))
            
            # Load files from byte subfolders or unknown_ambit
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=YEAR_PREFIX)
            files_per_byte = [lst for lst in files_per_byte if lst]
            
            print(f"Loaded files for {ambyte_folder_name} in {upload_dir_name}: {len(files_per_byte)}")
            
            # Process trace files
            df = process_trace_files(ambyte_folder_name, files_per_byte)
            
            if df is not None:
                # Convert pandas DataFrame to Spark DataFrame
                try:
                    # Reset index to make Time a regular column
                    df = df.reset_index()
                    
                    # Add upload directory info to the dataframe
                    df['upload_directory'] = upload_dir_name
                    
                    # Add upload time to the dataframe (convert to pandas timestamp first)
                    if upload_time is not None:
                        df['upload_time'] = upload_time
                    else:
                        df['upload_time'] = None
                    
                    # Convert pandas DataFrame to Spark DataFrame
                    spark_df = spark.createDataFrame(df)
                    
                    all_data.append(spark_df)
                except Exception as e:
                    print(f"Error converting DataFrame to Spark DataFrame for {ambyte_folder_name} in {upload_dir_name}: {e}")
    
    # Combine all spark dataframes if any were created
    if all_data:
        return all_data[0] if len(all_data) == 1 else all_data[0].unionAll(*all_data[1:])
    else:
        return spark.createDataFrame([], schema=raw_ambyte_schema)
    

# COMMAND ----------

# DBTITLE 1,Silver Ambyte Data Table
@dlt.table(
    name="silver_ambyte_data",
    comment="Clean ambyte data with outlier filtering, calibrations, and FMP2 calculations applied",
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true"
    }
)
def silver_ambyte_data():
    """
    Transform raw ambyte data into clean silver data following exact notebook processing logic.
    
    This function applies the exact same transformations as the pandas notebook:
    1. Calculate actinic quiet time
    2. Filter data after 2023
    3. Apply outlier detection and removal
    4. Subtract dark values
    5. Clean 7s/7r signals
    6. Apply PAR factor scaling to Leaf
    7. Calculate FMP2 values (Fs, Fmp, Fmp_T)
    """
    from pyspark.sql.window import Window
    
    # Read raw ambyte data
    raw_df = spark.read.table(f"{CATALOG_NAME}.{EXPERIMENT_SCHEMA}.{RAW_AMBYTE_TABLE}")
    
    # Step 1: Calculate actinic quiet time (exact match to notebook)
    # df.loc[df['Type'] == 'qE1', 'Act_time'] = df['Time']
    # df['Act_time'] = df['Act_time'].ffill()
    # df.loc[df['Act_time'].isna(), 'Act_time'] = df['Time']
    # df['Act_time'] = ((df['Time'] - df['Act_time']).astype(int) / 1e6).astype(np.int32)
    
    window_spec = Window.orderBy("Time").rowsBetween(Window.unboundedPreceding, Window.currentRow)
    
    df = (raw_df
          .withColumn("Act_time_temp", 
                     F.when(F.col("Type") == "qE1", F.col("Time")).otherwise(None))
          .withColumn("Act_time_filled", 
                     F.last("Act_time_temp", ignorenulls=True).over(window_spec))
          .withColumn("Act_time", 
                     F.coalesce(F.col("Act_time_filled"), F.col("Time")))
          .withColumn("Act_time", 
                     ((F.unix_timestamp("Time") - F.unix_timestamp("Act_time")) * 1000000).cast("integer"))
          .drop("Act_time_temp", "Act_time_filled"))
    
    # Step 2: Convert PAR to float (matching notebook)
    df = df.withColumn("PAR", F.col("PAR").cast("float"))
    
    # Step 3: Filter data after 2023 (exact match to notebook)
    # dfi = df[df['Time'] > "2023"]
    df = df.filter(F.col("Time") > F.lit("2023-01-01"))
    
    # Step 4: Apply outlier detection and removal for SigF and RefF (exact match to notebook)
    # data_mask = (dfi['SigF'] < dfi['SigF'].quantile(.01) - 50) | (dfi['SigF'] > dfi['SigF'].quantile(.99) + 500) | (dfi['RefF'] < dfi['RefF'].quantile(.01) - 50)
    # data_mask |= (dfi['SigF'] < dfi.attrs['Dark'])
    # dfi.loc[data_mask, "SigF"] = pd.NA
    
    sigf_q01 = df.stat.approxQuantile("SigF", [0.01], 0.01)[0]
    sigf_q99 = df.stat.approxQuantile("SigF", [0.99], 0.01)[0]
    reff_q01 = df.stat.approxQuantile("RefF", [0.01], 0.01)[0]
    
    df = (df
          .withColumn("SigF", 
                     F.when((F.col("SigF") < F.lit(sigf_q01 - 50)) |
                           (F.col("SigF") > F.lit(sigf_q99 + 500)) |
                           (F.col("RefF") < F.lit(reff_q01 - 50)) |
                           (F.col("SigF") < F.col("meta_Dark")), 
                           None)
                     .otherwise(F.col("SigF"))))
    
    # Step 5: Subtract dark values (exact match to notebook)
    # dfi.loc[:, "SigF"] -= dfi.attrs['Dark']
    df = df.withColumn("SigF", F.col("SigF") - F.col("meta_Dark"))
    
    # Step 6: Apply outlier detection and removal for Sig7 and Ref7 (exact match to notebook)
    # data_mask = (dfi['Sig7'] < dfi['Sig7'].quantile(.05)) | (dfi['Sig7'] > dfi['Sig7'].quantile(.95)) | (dfi['Ref7'] < dfi['Ref7'].quantile(.1))
    # dfi.loc[data_mask, ["Ref7", "Sig7"]] = pd.NA
    # dfi.loc[dfi['Actinic'] > 5, "Leaf"] = pd.NA
    
    sig7_q05 = df.stat.approxQuantile("Sig7", [0.05], 0.01)[0]
    sig7_q95 = df.stat.approxQuantile("Sig7", [0.95], 0.01)[0]
    ref7_q10 = df.stat.approxQuantile("Ref7", [0.1], 0.01)[0]
    
    df = (df
          .withColumn("Sig7", 
                     F.when((F.col("Sig7") < F.lit(sig7_q05)) |
                           (F.col("Sig7") > F.lit(sig7_q95)) |
                           (F.col("Ref7") < F.lit(ref7_q10)), 
                           None)
                     .otherwise(F.col("Sig7")))
          .withColumn("Ref7", 
                     F.when((F.col("Sig7") < F.lit(sig7_q05)) |
                           (F.col("Sig7") > F.lit(sig7_q95)) |
                           (F.col("Ref7") < F.lit(ref7_q10)), 
                           None)
                     .otherwise(F.col("Ref7")))
          .withColumn("Leaf", 
                     F.when(F.col("Actinic") > 5, None)
                     .otherwise(F.col("Leaf"))))
    
    # Step 7: Calculate PAR factor and scale Leaf (exact match to notebook)
    # par_factor = dfi.loc[dfi['PAR'] > 2, 'PAR'].mean() / dfi.loc[dfi['Leaf'] > 2, 'Leaf'].mean()
    # dfi['Leaf'] *= par_factor
    
    par_mean = df.filter(F.col("PAR") > 2).agg(F.mean("PAR")).collect()[0][0]
    leaf_mean = df.filter(F.col("Leaf") > 2).agg(F.mean("Leaf")).collect()[0][0]
    
    if par_mean is not None and leaf_mean is not None and leaf_mean != 0:
        par_factor = par_mean / leaf_mean
        df = df.withColumn("Leaf", F.col("Leaf") * F.lit(par_factor))
    
    # Step 8: Apply FMP2 calculations using extracted module
    # This matches: MPF_idx = df_ph2.groupby('Type', observed=True).get_group('MPF2').groupby('Count').apply(calc_FMP2, df.attrs['Actinic'])
    df = apply_fmp2_calculations(df)
    
    return df.withColumn("processed_timestamp", F.current_timestamp())


# COMMAND ----------

# DBTITLE 1,Plotting Ambyte Data Table (Gold Layer)
@dlt.table(
    name="plotting_ambyte_data",
    comment="Pre-aggregated ambyte data optimized for plotting and visualization",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true"
    }
)
def plotting_ambyte_data():
    """
    Create plotting-ready data that matches the exact structure needed for the notebook visualizations.
    
    This table pre-calculates all the aggregations and ratios needed for the matplotlib plots:
    1. Resampled time series (1s intervals) for temperature and light
    2. Actinic-grouped fluorescence data with color mapping
    3. Filtered MPF2 data points for special markers
    4. Pre-calculated ratios and derived values
    """
    
    # Read silver ambyte data
    silver_df = spark.read.table(f"{CATALOG_NAME}.{EXPERIMENT_SCHEMA}.silver_ambyte_data")
    
    # Create the main plotting dataset
    # Add derived columns that are frequently used in plotting
    plotting_df = (silver_df
                  .withColumn("fluor_ratio", F.col("SigF") / F.col("RefF"))
                  .withColumn("leaf_sqrt", F.pow(F.col("Leaf"), 0.5))
                  .withColumn("fmp_ratio", (F.col("Fmp") - F.col("Fs")) / F.col("Fmp"))
                  .withColumn("actinic_color", (F.pow(F.col("Actinic"), 0.5) / 20.0 + 0.1)))
    
    # Create time series resampled data for temperature and light plots
    non_mpf2_df = plotting_df.filter(F.col("Type") != "MPF2")
    
    # Create 1-second time windows for resampling
    resampled_df = (non_mpf2_df
                   .withColumn("time_window", F.window(F.col("Time"), "1 second"))
                   .groupBy("time_window", "ambit_index")
                   .agg(F.mean("Leaf").alias("leaf_mean"),
                        F.mean("Actinic").alias("actinic_mean"),
                        F.mean("Temp").alias("temp_mean"))
                   .withColumn("leaf_sqrt_mean", F.pow(F.col("leaf_mean"), 0.5))
                   .withColumn("time_start", F.col("time_window.start"))
                   .select("time_start", "ambit_index", "leaf_sqrt_mean", "temp_mean", "actinic_mean")
                   .withColumn("data_type", F.lit("resampled_timeseries")))
    
    # Create actinic-grouped fluorescence data 
    actinic_grouped_df = (plotting_df
                         .withColumn("pts_diff", 
                                   F.col("PTS") - F.lag("PTS").over(Window.partitionBy("Count").orderBy("Time")))
                         .withColumn("fluor_ratio_clean", 
                                   F.when(F.col("pts_diff") == 1, F.col("fluor_ratio")).otherwise(None))
                         .select("Time", "ambit_index", "Actinic", "fluor_ratio_clean", "actinic_color")
                         .filter(F.col("fluor_ratio_clean").isNotNull())
                         .withColumn("data_type", F.lit("actinic_grouped_fluor")))
    
    # Create MPF2 special marker data
    mpf2_markers_df = (plotting_df
                      .filter((F.col("Type") == "MPF2") & 
                             (F.col("Full") == True) & 
                             (F.col("Act_time") > 900) & 
                             (F.col("PTS") > 200) & 
                             (F.col("PTS") < 220))
                      .groupBy("Count", "ambit_index")
                      .agg(F.mean("Time").alias("time_mean"),
                           F.mean("fluor_ratio").alias("fluor_ratio_mean"),
                           F.count("SigF").alias("sigf_count"))
                      .filter(F.col("sigf_count") >= 10)
                      .select("time_mean", "ambit_index", "fluor_ratio_mean")
                      .withColumn("data_type", F.lit("mpf2_markers")))
    
    # Create FMP time series data
    fmp_timeseries_df = (plotting_df
                        .select("Time", "ambit_index", "Fs", "Fmp", "fmp_ratio")
                        .filter((F.col("Fs").isNotNull()) | (F.col("Fmp").isNotNull()))
                        .withColumn("data_type", F.lit("fmp_timeseries")))
    
    # Combine all plotting datasets with a unified schema
    # Each dataset type has different columns, so we'll create a flexible schema
    
    # Union all datasets with properly named columns for direct plotting use
    final_df = (
        # Resampled timeseries data - for temperature and light plots
        resampled_df
        .select(F.col("time_start").alias("time"),
               F.col("ambit_index"),
               F.col("data_type"),
               F.col("leaf_sqrt_mean").alias("leaf_sqrt"),  # Pre-computed (Leaf^0.5) - no algebra needed
               F.col("temp_mean").alias("temp"),            # Temperature for green dots
               F.col("actinic_mean").alias("actinic"),      # Actinic levels
               F.lit(None).cast("float").alias("value4"),
               F.lit(None).cast("float").alias("value5"))
        
        .union(
            # Actinic grouped fluorescence - for colored fluorescence lines
            actinic_grouped_df
            .select(F.col("Time").alias("time"),
                   F.col("ambit_index"),
                   F.col("data_type"),
                   F.col("Actinic").cast("float").alias("actinic"),          # Actinic level for grouping
                   F.col("fluor_ratio_clean").alias("fluor_ratio"),          # Pre-computed SigF/RefF ratio
                   F.col("actinic_color").alias("color_value"),              # Pre-computed color mapping
                   F.lit(None).cast("float").alias("value4"),
                   F.lit(None).cast("float").alias("value5"))
        )
        
        .union(
            # MPF2 markers - for yellow marker dots
            mpf2_markers_df
            .select(F.col("time_mean").alias("time"),
                   F.col("ambit_index"),
                   F.col("data_type"),
                   F.col("fluor_ratio_mean").alias("fluor_ratio_mean"),      # Pre-computed mean fluorescence ratio
                   F.lit(None).cast("float").alias("value2"),
                   F.lit(None).cast("float").alias("value3"),
                   F.lit(None).cast("float").alias("value4"),
                   F.lit(None).cast("float").alias("value5"))
        )
        
        .union(
            # FMP timeseries - for Fs/Fmp trend lines and efficiency calculation
            fmp_timeseries_df
            .select(F.col("Time").alias("time"),
                   F.col("ambit_index"),
                   F.col("data_type"),
                   F.col("Fs").alias("Fs"),                                  # Fs values for magenta line
                   F.col("Fmp").alias("Fmp"),                                # Fmp values for default line
                   F.col("fmp_ratio").alias("fmp_ratio"),                    # Pre-computed (Fmp-Fs)/Fmp efficiency
                   F.lit(None).cast("float").alias("value4"),
                   F.lit(None).cast("float").alias("value5"))
        )
    )
    
    return final_df.withColumn("processed_timestamp", F.current_timestamp())


# COMMAND ----------

# DBTITLE 1,Macro Processing Pipeline
def create_macro_tables():
    """
    Create DLT tables for each macro found in the experiment data
    This function should be called after the pipeline initialization
    """
    if not ENABLE_MACRO_PROCESSING:
        return []
    
    # Get the distinct macros from the central silver table for this experiment
    try:
        macros_df = (
            spark.read.table(
                f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}"
            )
            .filter(F.col("experiment_id") == EXPERIMENT_ID)
            .filter(F.col("macros").isNotNull())
            .filter(F.size(F.col("macros")) > 0)
            .select(F.explode(F.col("macros")).alias("macro_name"))
            .distinct()
        )
        
        # Get available macros and process each one
        available_macros = get_available_macros(MACROS_PATH)
        experiment_macros = [row.macro_name for row in macros_df.collect()]
        
        print(f"Available macros: {available_macros}")
        print(f"Macros used in experiment: {experiment_macros}")
        
        return experiment_macros, available_macros
    except Exception as e:
        print(f"Error reading macros from central table: {str(e)}")
        return [], []


def create_macro_table_code(macro_name: str) -> str:
    """
    Generate Python code for a macro table function
    
    Since DLT requires tables to be defined at module level with decorators,
    we need to dynamically generate and execute the function definitions.
    """
    return f'''
@dlt.table(
    name="macro_{macro_name}",
    comment="Output from macro: {macro_name}",
    table_properties={{
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true"
    }}
)
def macro_{macro_name}_table():
    """Process records through the {macro_name} macro and create output table"""
    # Read data that has this macro
    base_df = (
        spark.read.table(f"{{CATALOG_NAME}}.{{CENTRAL_SCHEMA}}.{{CENTRAL_SILVER_TABLE}}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)
        .filter(F.array_contains(F.col("macros"), "{macro_name}"))
    )
    
    # Collect all data to process through macro
    rows_data = base_df.collect()
    processed_rows = []
    
    for row in rows_data:
        try:
            # Prepare input data for the macro
            input_data = {{
                "device_id": getattr(row, 'device_id', None),
                "device_name": getattr(row, 'device_name', None),
                "experiment_id": getattr(row, 'experiment_id', None),
                "sample": getattr(row, 'sample', None),
                "macros": getattr(row, 'macros', None),
            }}
            
            # Remove None values
            input_data = {{k: v for k, v in input_data.items() if v is not None}}
            
            # Execute the macro using the library function
            output = execute_macro_script("{macro_name}", input_data, MACROS_PATH)
            
            if output:
                # Add metadata to output
                output["macro_name"] = "{macro_name}"

                # Add user_answers columns to output
                output["plot_number"] = getattr(row, 'plot_number', None)
                output["plant"] = getattr(row, 'plant', None)
                output["stem_count"] = getattr(row, 'stem_count', None)
                
                # Process output for Spark compatibility using library function
                processed_output = process_macro_output_for_spark(output)
                processed_rows.append(processed_output)
        
        except Exception as e:
            print(f"Error processing row for macro {macro_name}: {{str(e)}}")
            continue
    
    if processed_rows:
        df = spark.createDataFrame(processed_rows)
        return df.withColumn("processed_timestamp", F.current_timestamp())
    else:
        # Return empty DataFrame with minimal schema
        minimal_schema = StructType([
            StructField("macro_name", StringType(), False),
            StructField("experiment_id", StringType(), False),
            StructField("processed_timestamp", TimestampType(), False)
        ])
        empty_df = spark.createDataFrame([], minimal_schema)
        return empty_df.withColumn("processed_timestamp", F.current_timestamp())
'''


# Initialize macro processing by generating table functions at module level
if ENABLE_MACRO_PROCESSING:
    try:
        experiment_macros, available_macros = create_macro_tables()
        
        # Generate and execute table function code for each macro
        for macro_name in experiment_macros:
            if macro_name in available_macros:
                print(f"Creating DLT table function for macro: {macro_name}")
                
                # Generate the function code
                table_code = create_macro_table_code(macro_name)
                
                # Execute the code to define the function at module level
                exec(table_code, globals())
                
            else:
                print(f"Warning: Macro {macro_name} referenced in data but script not found")
        
        print("Macro processing setup complete")
        
    except Exception as e:
        print(f"Error setting up macro processing: {str(e)}")
        print("Continuing without macro processing...")
else:
    print("Macro processing disabled")