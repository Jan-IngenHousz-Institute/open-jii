from setuptools import setup, find_packages

setup(
    name="data_repair",
    version="0.1.0",
    description="Reusable data repair / overlay framework for openJII Databricks pipelines",
    author="openJII Team",
    packages=find_packages(),
    python_requires=">=3.7",
    include_package_data=True,
    zip_safe=False,
)
