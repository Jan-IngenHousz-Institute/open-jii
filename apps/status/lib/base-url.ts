// Only builds that know their public address set it; the rest leave metadata URLs relative.
export const BASE_URL = process.env.STATUS_BASE_URL
  ? new URL(process.env.STATUS_BASE_URL)
  : undefined;
