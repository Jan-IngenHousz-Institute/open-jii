from setuptools import setup, find_packages

setup(
    name="multispeq",
    version="0.1.0",
    description="MultispeQ Data Processing Package for OpenJII",
    author="OpenJII Team",
    packages=find_packages(),
    python_requires=">=3.7",
    include_package_data=True,
    package_data={
        "multispeq.helpers": ["*.js"],
    },
    zip_safe=False,
)