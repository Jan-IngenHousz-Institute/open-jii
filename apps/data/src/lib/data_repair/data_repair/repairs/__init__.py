"""
Each repair lives in its own file under this package and registers itself
on import via the @register_function_repair / @register_overlay_repair
decorators in ../manifest.py.

To add a new repair, create a file here following the convention:
    YYYY_MM_<short_name>.py

…and import it below so its decorator runs at package load time.
"""
# Repairs are imported here for their decorator side-effect.
# Add new ones below as they're created.
