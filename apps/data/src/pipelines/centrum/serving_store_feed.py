# Databricks notebook source
# DBTITLE 1,Serving store feed
# Sends each row the measurement and upload gold tables gain to the serving store.

# COMMAND ----------
from pyspark import pipelines as dp

from openjii.centrum.runtime import ENVIRONMENT
from openjii.serving_store.feed import StoreFeed
from openjii.serving_store.tables import MEASUREMENTS, UPLOADS

# COMMAND ----------

feed = StoreFeed(dp, spark, dbutils, ENVIRONMENT)
feed.define(MEASUREMENTS)
feed.define(UPLOADS)
