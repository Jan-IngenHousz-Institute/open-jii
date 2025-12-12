from setuptools import setup, find_packages
import pathlib

here = pathlib.Path(__file__).parent.resolve()
long_description = (here / "README.md").read_text(encoding="utf-8")


setup(
    name='multispeq_mqtt_interface',
    version='0.1.0',
    author='JII',
    author_email='ji-institute@info.nl',
    description='A command-line interface for interacting with the openJII MQTT broker in MultispeQ applications.',
    packages=find_packages(where='src'),
    py_modules=["main"],
    package_dir={'': 'src'},
    install_requires=[
        'pyyaml',
        'awsiotsdk',
        'awscrt',
        'jii_multispeq @ git+https://github.com/Jan-IngenHousz-Institute/JII-MultispeQ.git'
    ],
    entry_points={
        'console_scripts': [
            'mmi = multispeq_mqtt_interface.main:main',
        ],
    },
)
