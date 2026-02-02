# Databricks notebook source
# MAGIC %md
# MAGIC # Your Analysis Title Here
# MAGIC 
# MAGIC **Description:** Brief description of what this notebook does
# MAGIC 
# MAGIC **Author:** Your Name
# MAGIC 
# MAGIC **Date:** 2025-12-19
# MAGIC 
# MAGIC ## Objective
# MAGIC What questions are you trying to answer with this analysis?

# COMMAND ----------

# MAGIC %md
# MAGIC ## Setup: Import Libraries and Helper Functions

# COMMAND ----------

# MAGIC %pip install -q /Workspace/Shared/wheels/openjii-0.1.0-py3-none-any.whl

# COMMAND ----------

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
from openjii import read_table, explode_set_data, get_catalog_name

print("✅ OpenJII helpers loaded!")
print(f"   Catalog: {get_catalog_name()}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Load Data
# MAGIC 
# MAGIC Available tables:
# MAGIC - `measurements_processed_sample` - Processed measurements with sample data
# MAGIC - `measurements_processed_with_raw_traces_sample` - Includes raw sensor traces
# MAGIC - `measurements_unprocessed_sample` - Unprocessed measurements
# MAGIC - `measurements_unprocessed_full_sample` - Full unprocessed data
# MAGIC - `measurements_metadata` - Measurement metadata
# MAGIC - `project_metadata` - Project information

# COMMAND ----------

# Load your data here
# Example: df = read_table('measurements_processed_sample', schema='default', limit=100)

df = read_table('measurements_processed_sample', schema='default', limit=100)

print(f"📊 Loaded {len(df)} rows")
print(f"Columns: {list(df.columns)}")
df.head()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Extract Nested Measurement Data
# MAGIC 
# MAGIC Use `explode_set_data()` to flatten the nested `set` array into individual measurement rows.

# COMMAND ----------

# Explode the nested set data
# Example: df_exploded = explode_set_data(df)

df_exploded = explode_set_data(df)

print(f"📊 Exploded to {len(df_exploded)} measurement records")
df_exploded.head()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Your Analysis Here
# MAGIC 
# MAGIC Add your analysis cells below. Some ideas:
# MAGIC - Exploratory data analysis
# MAGIC - Statistical tests
# MAGIC - Visualizations
# MAGIC - Correlations
# MAGIC - Time-series analysis

# COMMAND ----------

# Your code here

# COMMAND ----------

# MAGIC %md
# MAGIC ## Results and Conclusions
# MAGIC 
# MAGIC Summarize your findings here.

# COMMAND ----------

# Final visualizations or summary statistics

# COMMAND ----------

# MAGIC %md
# MAGIC ## Next Steps
# MAGIC 
# MAGIC - What additional analyses could be done?
# MAGIC - What data quality issues did you encounter?
# MAGIC - What questions remain unanswered?
