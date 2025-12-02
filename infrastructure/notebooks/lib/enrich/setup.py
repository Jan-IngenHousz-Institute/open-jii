from setuptools import setup, find_packages

setup(
    name="enrich",
    version="0.1.0",
    description="Data enrichment utilities for OpenJII Databricks pipelines",
    author="OpenJII Team",
    packages=find_packages(),
    python_requires=">=3.7",
    include_package_data=True,
    zip_safe=False,
)