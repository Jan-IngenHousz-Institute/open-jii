from setuptools import setup, find_packages

setup(
    name="exports",
    version="0.1.0",
    description="Export-format helpers for openJII Databricks tasks",
    author="openJII Team",
    packages=find_packages(),
    install_requires=[
        "pandas>=1.0.0",
        "openpyxl>=3.1.0",
    ],
    python_requires=">=3.7",
    include_package_data=True,
    zip_safe=False,
)
