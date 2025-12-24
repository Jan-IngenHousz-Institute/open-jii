from setuptools import setup, find_packages

setup(
    name="photosynq",
    version="0.1.0",
    description="PhotosynQ Data Analysis Helpers for openJII",
    author="openJII Team",
    packages=find_packages(),
    install_requires=[
        "pandas>=1.0.0",
    ],
    python_requires=">=3.7",
    include_package_data=True,
    zip_safe=False,
)
