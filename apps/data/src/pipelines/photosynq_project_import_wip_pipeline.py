"""
DLT Pipeline for PhotosynQ Project Transfer Data
Reads parquet files from volume into Delta Live Tables
Fixed to a particular PhotosynQ project transfer dataset and therefore a particular protocol/macro schema.
"""

import dlt
from pyspark.sql.functions import col, explode, from_json

# Configuration
VOLUME_PATH = "/Volumes/open_jii_data_hackathon/default/hackathon_data_volume/33338-potato_grebbedijk_2025"

# Schema definition for sample JSON data (inferred from actual data)
SAMPLE_SCHEMA = """
ARRAY<STRUCT<
    protocol_id: STRING, 
    ri: ARRAY<BIGINT>, 
    set: ARRAY<STRUCT<
        absorbance: ARRAY<ARRAY<DOUBLE>>, 
        angle: DOUBLE, 
        autogain: ARRAY<ARRAY<BIGINT>>, 
        b: DOUBLE, 
        compass: DOUBLE, 
        compass_direction: STRING, 
        contactless_temp: DOUBLE, 
        data_raw: ARRAY<BIGINT>, 
        dw14: BIGINT, 
        e_time: ARRAY<BIGINT>, 
        g: DOUBLE, 
        humidity: DOUBLE, 
        humidity2: DOUBLE, 
        label: STRING, 
        light_intensity: DOUBLE, 
        pi: ARRAY<DOUBLE>, 
        pitch: DOUBLE, 
        pressure: DOUBLE, 
        pressure2: DOUBLE, 
        r: DOUBLE, 
        recall: STRUCT<
            settings: STRUCT<
                blink_mode: BIGINT, 
                calTimes: ARRAY<BIGINT>, 
                closed_position: DOUBLE, 
                compiled: ARRAY<STRING>, 
                detector_offsets: ARRAY<DOUBLE>, 
                device_id: STRING, 
                device_name: STRING, 
                device_version: STRING, 
                firmware: DOUBLE, 
                light_slope_all: ARRAY<DOUBLE>, 
                light_slope_b: ARRAY<DOUBLE>, 
                light_slope_g: ARRAY<DOUBLE>, 
                light_slope_r: ARRAY<DOUBLE>, 
                light_yint: ARRAY<DOUBLE>, 
                mag_address: BIGINT, 
                mag_orientation: DOUBLE, 
                max_PAR: ARRAY<BIGINT>, 
                open_position: DOUBLE, 
                par_map: ARRAY<ARRAY<BIGINT>>, 
                par_tweak: DOUBLE, 
                pilot_blink: BIGINT, 
                pix_pin: BIGINT, 
                `shutdown_time (s)`: BIGINT, 
                spad_offset: DOUBLE, 
                spad_scale: DOUBLE, 
                spad_yint: DOUBLE, 
                status_blink: BIGINT, 
                thickness_a: DOUBLE, 
                thickness_b: DOUBLE, 
                thickness_c: DOUBLE, 
                usb_on: BIGINT
            >
        >, 
        ri: BIGINT, 
        roll: DOUBLE, 
        s: BIGINT, 
        spad: ARRAY<DOUBLE>, 
        temperature: DOUBLE, 
        temperature2: DOUBLE, 
        w: DOUBLE
    >>, 
    set_repeats: BIGINT, 
    time: BIGINT, 
    v_arrays: ARRAY<ARRAY<STRING>>
>>
"""

@dlt.table(name="project_metadata")
def project_metadata():
    return spark.read.parquet(f"{VOLUME_PATH}/project_metadata.parquet")


@dlt.table(name="measurements_metadata")
def measurements_metadata():
    return spark.read.parquet(f"{VOLUME_PATH}/measurements_metadata.parquet")


@dlt.table(name="measurements_processed")
def measurements_processed():
    return spark.read.parquet(f"{VOLUME_PATH}/measurements_processed.parquet")


@dlt.table(name="measurements_processed_with_raw_traces")
def measurements_processed_with_raw_traces():
    return spark.read.parquet(f"{VOLUME_PATH}/measurements_processed_with_raw_traces.parquet")


@dlt.table(name="measurements_unprocessed")
def measurements_unprocessed():
    return spark.read.parquet(f"{VOLUME_PATH}/measurements_unprocessed.parquet")


@dlt.table(name="measurements_unprocessed_full")
def measurements_unprocessed_full():
    return spark.read.parquet(f"{VOLUME_PATH}/measurements_unprocessed_full.parquet")


# Sample data extraction tables - parsing JSON strings with explicit schema
@dlt.table(name="measurements_processed_sample")
def measurements_processed_sample():
    """Extract and flatten sample JSON from measurements_processed"""
    df = dlt.read("measurements_processed")
    
    # Parse sample column as JSON string with explicit schema, then explode array
    return (df
            .filter(col("sample").isNotNull())
            .withColumn("sample_parsed", from_json(col("sample"), SAMPLE_SCHEMA))
            .withColumn("sample_item", explode(col("sample_parsed")))
            .select(
                "datum_id",
                col("time").alias("device_time"), 
                "user_id",
                "device_id",
                "sample_item.*"
            ))


@dlt.table(name="measurements_processed_with_raw_traces_sample")
def measurements_processed_with_raw_traces_sample():
    """Extract and flatten sample JSON from measurements_processed_with_raw_traces"""
    df = dlt.read("measurements_processed_with_raw_traces")
    
    # Parse sample column as JSON string with explicit schema, then explode array
    return (df
            .filter(col("sample").isNotNull())
            .withColumn("sample_parsed", from_json(col("sample"), SAMPLE_SCHEMA))
            .withColumn("sample_item", explode(col("sample_parsed")))
            .select(
                "datum_id",
                col("time").alias("device_time"),
                "user_id", 
                "device_id",
                "sample_item.*"
            ))


@dlt.table(name="measurements_unprocessed_sample")
def measurements_unprocessed_sample():
    """Extract and flatten sample JSON from measurements_unprocessed"""
    df = dlt.read("measurements_unprocessed")
    
    # Parse sample_data column as JSON string with explicit schema, then explode array
    return (df
            .filter(col("sample_data").isNotNull())
            .withColumn("sample_parsed", from_json(col("sample_data"), SAMPLE_SCHEMA))
            .withColumn("sample_item", explode(col("sample_parsed")))
            .select(
                "measurement_id",
                "sample_item.*"
            ))


@dlt.table(name="measurements_unprocessed_full_sample")
def measurements_unprocessed_full_sample():
    """Extract and flatten sample JSON from measurements_unprocessed_full"""
    df = dlt.read("measurements_unprocessed_full")
    
    # Parse sample column as JSON string with explicit schema, then explode array
    return (df
            .filter(col("sample").isNotNull())
            .withColumn("sample_parsed", from_json(col("sample"), SAMPLE_SCHEMA))
            .withColumn("sample_item", explode(col("sample_parsed")))
            .select(
                "datum_id",
                col("time").alias("device_time"),
                "user_id",
                "device_id",
                "sample_item.*"
            ))
