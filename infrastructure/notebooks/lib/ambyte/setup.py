from setuptools import setup, find_packages

setup(
    name="ambyte",
    version="0.1.0",
    description="Ambyte Data Processing Package for OpenJII",
    author="OpenJII Team",
    packages=find_packages(),
    python_requires=">=3.7",
    include_package_data=True,
    zip_safe=False,
)