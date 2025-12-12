from setuptools import setup, find_packages

setup(
    name="multispeq",
    version="0.1.0",
    description="MultispeQ Data Processing Package for openJII",
    author="openJII Team",
    packages=find_packages(),
    python_requires=">=3.7",
    include_package_data=True,
    package_data={
        "multispeq.helpers": ["*.js", "*.r"],
    },
    zip_safe=False,
)
