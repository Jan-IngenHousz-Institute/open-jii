# Databricks notebook source
# DBTITLE 1,Serving store feed
# Sends each row the macro results gold table gains to the serving store.

# COMMAND ----------
from pyspark import pipelines as dp

from openjii.macros.runtime import ENVIRONMENT
from openjii.serving_store.feed import StoreFeed
from openjii.serving_store.tables import MACRO_RESULTS

# COMMAND ----------

feed = StoreFeed(dp, spark, dbutils, ENVIRONMENT)
feed.define(MACRO_RESULTS)
