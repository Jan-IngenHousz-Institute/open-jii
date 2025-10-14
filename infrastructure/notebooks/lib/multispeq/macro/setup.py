from setuptools import setup, find_packages

setup(
    name="macro",
    version="0.1.0",
    description="MultispeQ Macro Processing Package for OpenJII",
    author="OpenJII",
    packages=find_packages(),
    python_requires=">=3.7",
    include_package_data=True,
    package_data={
        "macro.helpers": ["*.js"],
    },
    zip_safe=False,
)