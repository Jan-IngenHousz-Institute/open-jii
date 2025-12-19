# Databricks notebook source
# MAGIC %md
# MAGIC # Welcome to PhotosynQ Data Analysis on Databricks
# MAGIC 
# MAGIC This notebook will guide you through analyzing PhotosynQ measurement data using tools you're already familiar with: **pandas**, **numpy**, **scipy**, and **matplotlib**.
# MAGIC 
# MAGIC ## What's in this workspace?
# MAGIC 
# MAGIC We have processed PhotosynQ measurement data from potato fields in Grebbedijk (2025). The data includes:
# MAGIC - **Project and measurement metadata**
# MAGIC - **Sample measurements** with detailed sensor readings (temperature, humidity, light intensity, etc.)
# MAGIC - **Nested measurement sets** containing time-series data from the MultispeQ device
# MAGIC 
# MAGIC ## Databricks ❤️ Pandas
# MAGIC 
# MAGIC Even though Databricks uses **Apache Spark** under the hood for big data processing, you can easily convert Spark DataFrames to pandas DataFrames for analysis. We'll show you how!

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Helper Functions: Making Databricks Feel Like Pandas
# MAGIC 
# MAGIC Let's create two reusable functions that will make working with our data feel just like working with pandas:
# MAGIC 
# MAGIC 1. **`read_table()`** - Read a Spark table and convert it to pandas
# MAGIC 2. **`explode_set_data()`** - Extract nested measurement data from the `set` column

# COMMAND ----------

# MAGIC %pip install -q /Workspace/Repos/.../infrastructure/notebooks/lib/openjii/dist/openjii-0.1.0-py3-none-any.whl --force-reinstall

# COMMAND ----------

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from openjii import read_table, explode_set_data, get_catalog_name

print("✅ OpenJII helpers loaded!")
print(f"   Catalog: {get_catalog_name()}")
print("   - read_table(table_name, schema, limit=None)")
print("   - explode_set_data(df, set_column='set')")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Loading Sample Data
# MAGIC 
# MAGIC Let's start by loading a subset of the processed measurements. We'll look at the **`measurements_processed_sample`** table which contains the parsed JSON sample data.

# COMMAND ----------

# Load a sample of measurements (limit to 100 for quick exploration)
measurements_df = read_table('measurements_processed_sample', schema='default', limit=100)

print(f"📊 Loaded {len(measurements_df)} measurements")
print(f"\nColumns: {list(measurements_df.columns)}")
print(f"\nDataFrame shape: {measurements_df.shape}")

# Display first few rows
measurements_df.head()

# COMMAND ----------

# MAGIC %md
# MAGIC ### Understanding the Data Structure
# MAGIC 
# MAGIC Notice the **`set`** column? This contains an array of measurement records from the MultispeQ device. Each element in this array is a struct with fields like:
# MAGIC - `temperature`, `temperature2` - Temperature readings
# MAGIC - `humidity`, `humidity2` - Humidity readings  
# MAGIC - `light_intensity` - Light sensor data
# MAGIC - `data_raw` - Raw sensor data arrays
# MAGIC - `label` - Description of the measurement type
# MAGIC - And many more!

# COMMAND ----------

# Let's peek at the structure of one 'set' array
sample_set = measurements_df['set'].iloc[0]
print(f"Number of measurements in this set: {len(sample_set) if isinstance(sample_set, list) else 'N/A'}")
print(f"\nFirst measurement in set:")
print(sample_set[0] if isinstance(sample_set, list) and len(sample_set) > 0 else sample_set)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Extracting Measurement Data from the `set` Array
# MAGIC 
# MAGIC Now let's use our `explode_set_data()` function to flatten the nested measurements into a nice tabular format that's easy to analyze.

# COMMAND ----------

# Explode the set column to get individual measurements
measurements_exploded = explode_set_data(measurements_df)

print(f"📊 Exploded to {len(measurements_exploded)} individual measurement records")
print(f"\nNew columns extracted from 'set': {[col for col in measurements_exploded.columns if col not in measurements_df.columns]}")

measurements_exploded.head(10)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Basic Data Exploration
# MAGIC 
# MAGIC Now that we have our data in a flat pandas DataFrame, let's do some basic exploration using familiar pandas operations.

# COMMAND ----------

# Summary statistics for key measurement fields
numeric_cols = ['temperature', 'temperature2', 'humidity', 'humidity2', 'light_intensity', 'pressure', 'pressure2']
available_cols = [col for col in numeric_cols if col in measurements_exploded.columns]

print("📈 Summary Statistics for Key Measurements:\n")
measurements_exploded[available_cols].describe()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Analyzing Temperature Data
# MAGIC 
# MAGIC Let's look at temperature readings across measurements.

# COMMAND ----------

# Filter to rows with valid temperature data
temp_data = measurements_exploded[
    (measurements_exploded['temperature'].notna()) & 
    (measurements_exploded['temperature'] > 0)
].copy()

print(f"📊 {len(temp_data)} measurements with temperature data")

# Calculate basic statistics
if len(temp_data) > 0:
    print(f"\n🌡️  Temperature Statistics:")
    print(f"   Mean: {temp_data['temperature'].mean():.2f}°C")
    print(f"   Std Dev: {temp_data['temperature'].std():.2f}°C")
    print(f"   Min: {temp_data['temperature'].min():.2f}°C")
    print(f"   Max: {temp_data['temperature'].max():.2f}°C")
    
    # Plot temperature distribution
    plt.figure(figsize=(10, 6))
    plt.hist(temp_data['temperature'], bins=30, edgecolor='black', alpha=0.7)
    plt.xlabel('Temperature (°C)')
    plt.ylabel('Frequency')
    plt.title('Distribution of Temperature Measurements')
    plt.grid(axis='y', alpha=0.3)
    plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Analyzing Humidity Data

# COMMAND ----------

# Filter to rows with valid humidity data
humidity_data = measurements_exploded[
    (measurements_exploded['humidity'].notna()) & 
    (measurements_exploded['humidity'] > 0)
].copy()

print(f"📊 {len(humidity_data)} measurements with humidity data")

if len(humidity_data) > 0:
    print(f"\n💧 Humidity Statistics:")
    print(f"   Mean: {humidity_data['humidity'].mean():.2f}%")
    print(f"   Std Dev: {humidity_data['humidity'].std():.2f}%")
    print(f"   Min: {humidity_data['humidity'].min():.2f}%")
    print(f"   Max: {humidity_data['humidity'].max():.2f}%")
    
    # Plot humidity distribution
    plt.figure(figsize=(10, 6))
    plt.hist(humidity_data['humidity'], bins=30, edgecolor='black', alpha=0.7, color='steelblue')
    plt.xlabel('Humidity (%)')
    plt.ylabel('Frequency')
    plt.title('Distribution of Humidity Measurements')
    plt.grid(axis='y', alpha=0.3)
    plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 7. Temperature vs Humidity Correlation

# COMMAND ----------

# Get measurements with both temperature and humidity
combined_data = measurements_exploded[
    (measurements_exploded['temperature'].notna()) & 
    (measurements_exploded['humidity'].notna()) &
    (measurements_exploded['temperature'] > 0) & 
    (measurements_exploded['humidity'] > 0)
].copy()

if len(combined_data) > 0:
    # Calculate correlation
    correlation = combined_data['temperature'].corr(combined_data['humidity'])
    print(f"📊 Correlation between Temperature and Humidity: {correlation:.3f}")
    
    # Scatter plot
    plt.figure(figsize=(10, 6))
    plt.scatter(combined_data['temperature'], combined_data['humidity'], alpha=0.5)
    plt.xlabel('Temperature (°C)')
    plt.ylabel('Humidity (%)')
    plt.title(f'Temperature vs Humidity (correlation: {correlation:.3f})')
    plt.grid(alpha=0.3)
    plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 8. Analyzing Light Intensity

# COMMAND ----------

# Filter to rows with valid light intensity data
light_data = measurements_exploded[
    (measurements_exploded['light_intensity'].notna()) & 
    (measurements_exploded['light_intensity'] > 0)
].copy()

print(f"📊 {len(light_data)} measurements with light intensity data")

if len(light_data) > 0:
    print(f"\n☀️  Light Intensity Statistics:")
    print(f"   Mean: {light_data['light_intensity'].mean():.2f}")
    print(f"   Std Dev: {light_data['light_intensity'].std():.2f}")
    print(f"   Min: {light_data['light_intensity'].min():.2f}")
    print(f"   Max: {light_data['light_intensity'].max():.2f}")
    
    # Plot light intensity distribution
    plt.figure(figsize=(10, 6))
    plt.hist(light_data['light_intensity'], bins=30, edgecolor='black', alpha=0.7, color='orange')
    plt.xlabel('Light Intensity')
    plt.ylabel('Frequency')
    plt.title('Distribution of Light Intensity Measurements')
    plt.grid(axis='y', alpha=0.3)
    plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 9. Exploring Measurement Labels
# MAGIC 
# MAGIC The `label` field describes what type of measurement each record represents. Let's see what types of measurements we have.

# COMMAND ----------

# Count measurements by label
label_counts = measurements_exploded['label'].value_counts()

print(f"📊 Measurement Types:\n")
print(label_counts)

# Plot distribution
plt.figure(figsize=(12, 6))
label_counts.plot(kind='bar', color='steelblue', edgecolor='black')
plt.xlabel('Measurement Label')
plt.ylabel('Count')
plt.title('Distribution of Measurement Types')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 10. Analyzing Environmental Conditions by Label
# MAGIC 
# MAGIC Let's see how temperature varies across different measurement types.

# COMMAND ----------

# Get temperature data grouped by label
temp_by_label = measurements_exploded[
    (measurements_exploded['temperature'].notna()) & 
    (measurements_exploded['temperature'] > 0) &
    (measurements_exploded['label'].notna())
].groupby('label')['temperature'].agg(['mean', 'std', 'count'])

temp_by_label = temp_by_label[temp_by_label['count'] >= 5].sort_values('mean', ascending=False)

print("🌡️  Average Temperature by Measurement Type:\n")
print(temp_by_label)

# Plot
if len(temp_by_label) > 0:
    plt.figure(figsize=(12, 6))
    temp_by_label['mean'].plot(kind='bar', yerr=temp_by_label['std'], 
                                 color='coral', edgecolor='black', capsize=4)
    plt.xlabel('Measurement Label')
    plt.ylabel('Temperature (°C)')
    plt.title('Average Temperature by Measurement Type')
    plt.xticks(rotation=45, ha='right')
    plt.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 11. Working with Time-Series Data
# MAGIC 
# MAGIC The `time` field in the dataset represents timestamps. Let's analyze measurements over time.

# COMMAND ----------

# Convert time to datetime if it's in unix timestamp format (milliseconds)
if 'time' in measurements_exploded.columns:
    measurements_exploded['timestamp'] = pd.to_datetime(measurements_exploded['time'], unit='ms', errors='coerce')
    
    # Filter to valid timestamps with temperature data
    time_series = measurements_exploded[
        (measurements_exploded['timestamp'].notna()) &
        (measurements_exploded['temperature'].notna()) & 
        (measurements_exploded['temperature'] > 0)
    ].sort_values('timestamp')
    
    if len(time_series) > 0:
        print(f"📊 {len(time_series)} measurements with valid timestamps")
        print(f"   Date range: {time_series['timestamp'].min()} to {time_series['timestamp'].max()}")
        
        # Plot temperature over time
        plt.figure(figsize=(14, 6))
        plt.plot(time_series['timestamp'], time_series['temperature'], alpha=0.6, linewidth=0.8)
        plt.xlabel('Time')
        plt.ylabel('Temperature (°C)')
        plt.title('Temperature Measurements Over Time')
        plt.grid(alpha=0.3)
        plt.tight_layout()
        plt.show()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 12. Next Steps
# MAGIC 
# MAGIC Now that you're familiar with the basics, here are some ideas for further exploration:
# MAGIC 
# MAGIC ### Load More Data
# MAGIC ```python
# MAGIC # Load more measurements (remove or increase the limit)
# MAGIC all_measurements = read_table('measurements_processed_sample', schema='default', limit=1000)
# MAGIC all_exploded = explode_set_data(all_measurements)
# MAGIC ```
# MAGIC 
# MAGIC ### Explore Other Tables
# MAGIC - `measurements_processed_with_raw_traces_sample` - Same data with raw trace arrays
# MAGIC - `measurements_unprocessed_sample` - Unprocessed measurements
# MAGIC - `measurements_metadata` - Metadata about each measurement
# MAGIC - `project_metadata` - Project-level information
# MAGIC 
# MAGIC ### Advanced Analysis Ideas
# MAGIC - Analyze the `data_raw` arrays for detailed sensor readings
# MAGIC - Compare processed vs unprocessed measurements
# MAGIC - Use scipy for statistical tests (t-tests, ANOVA, etc.)
# MAGIC - Analyze measurement quality using the `recall.settings` data
# MAGIC - Group by `device_id` to compare different MultispeQ devices
# MAGIC 
# MAGIC ### Example: Loading Another Table
# MAGIC ```python
# MAGIC metadata = read_table('measurements_metadata', schema='default', limit=100)
# MAGIC metadata.head()
# MAGIC ```
# MAGIC 
# MAGIC Happy analyzing! 🎉

# COMMAND ----------

# MAGIC %md
# MAGIC ---
# MAGIC 
# MAGIC **Pro Tip:** You can always use SQL too! Databricks supports mixing SQL and Python:
# MAGIC 
# MAGIC ```python
# MAGIC # SQL query
# MAGIC from openjii import get_catalog_name
# MAGIC catalog = get_catalog_name()
# MAGIC 
# MAGIC result = spark.sql(f"""
# MAGIC     SELECT device_id, COUNT(*) as measurement_count
# MAGIC     FROM {catalog}.default.measurements_processed_sample
# MAGIC     GROUP BY device_id
# MAGIC     ORDER BY measurement_count DESC
# MAGIC """)
# MAGIC 
# MAGIC # Convert to pandas
# MAGIC result.toPandas()
# MAGIC ```
