from setuptools import setup, find_packages
from setuptools.command.build_py import build_py
import os

# Read catalog name from environment variable at build time
# This allows building different wheels for different catalogs
CATALOG_NAME = os.environ.get("OPENJII_CATALOG", "default_catalog")


class BuildPyCommand(build_py):
    """Custom build command to generate configuration file during build."""
    
    def run(self):
        """Generate config before running the standard build."""
        # Run the standard build first
        super().run()
        # Then write the config file to the build output directory
        self.write_config()
    
    def write_config(self):
        """Write the catalog configuration to the build directory."""
        # Write to the build output directory, not the source directory
        if self.build_lib:
            config_file = os.path.join(self.build_lib, "openjii", "_config.py")
        else:
            config_file = os.path.join(os.path.dirname(__file__), "openjii", "_config.py")
        
        os.makedirs(os.path.dirname(config_file), exist_ok=True)
        
        with open(config_file, "w") as f:
            f.write(f'"""Auto-generated configuration file"""\n')
            f.write(f'CATALOG_NAME = "{CATALOG_NAME}"\n')


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
    cmdclass={
        'build_py': BuildPyCommand,
    },
)
