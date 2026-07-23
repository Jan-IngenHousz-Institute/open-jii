# @repo/iot

Shared IoT types and connector logic for talking to measurement devices over local connections (serial/BLE) — device identification, connection handling, and message validation used by the web and mobile workbook hosts. Locally identifiable sensor families are MultispeQ, Ambit, and MiniPAR, plus a generic fallback driver (Ambyte devices upload autonomously and are handled through the generic route rather than a dedicated local driver).
