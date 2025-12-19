from setuptools import setup, find_packages
import os

# Read catalog name from environment variable at build time
# This allows building different wheels for different catalogs
CATALOG_NAME = os.environ.get("OPENJII_CATALOG", "default_catalog")

setup(
    name="openjii",
    version="0.1.0",
    description="OpenJII Data Analysis Helpers for Databricks",
    author="openJII Team",
    packages=find_packages(),
    install_requires=[
        "pandas>=1.0.0",
    ],
    python_requires=">=3.7",
    include_package_data=True,
    zip_safe=False,
)

# Write catalog configuration to package
config_file = os.path.join(os.path.dirname(__file__), "openjii", "_config.py")
with open(config_file, "w") as f:
    f.write(f'"""Auto-generated configuration file"""\n')
    f.write(f'CATALOG_NAME = "{CATALOG_NAME}"\n')
