# Databricks notebook source
# DBTITLE 1,Serving store feed
# Sends each row the measurement and upload gold tables gain, and each connectivity event silver
# gains, to the serving store, and the rows of the metadata sheets as the backend's copy of them
# changes.

# COMMAND ----------
from pyspark import pipelines as dp

from openjii.centrum.runtime import CATALOG_NAME, ENVIRONMENT
from openjii.serving_store.feed import StoreFeed
from openjii.serving_store.tables import DEVICE_EVENTS, MEASUREMENTS, METADATA_ROWS, UPLOADS

# COMMAND ----------

feed = StoreFeed(dp, spark, dbutils, ENVIRONMENT, CATALOG_NAME)
feed.define(MEASUREMENTS)
feed.define(UPLOADS)
feed.define(METADATA_ROWS)
feed.define(DEVICE_EVENTS)
