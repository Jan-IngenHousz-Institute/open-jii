"""
Each repair lives in its own file under this package and registers itself
on import via the @inline_repair / @overlay_repair decorators in
../manifest.py.

To add a new repair, create a file here following the convention:
    _YYYY_MM_<short_name>.py

(Leading underscore keeps the module name a valid Python identifier; the
chronological YYYY_MM prefix mirrors Alembic/Django migrations so
registration order is obvious in `git log` and `ls`.)

Then import it below so its decorator runs at package load time.
"""
# Repairs are imported here for their decorator side-effect.
# Add new ones below as they're created.
from . import _2026_04_rides_inplace  # noqa: F401
