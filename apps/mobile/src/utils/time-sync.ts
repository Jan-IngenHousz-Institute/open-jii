interface TimeSyncResult {
  utcTimestamp: number;
  timezone: string;
}

export interface WorldTimeApiResponse {
  abbreviation: string;
  client_ip: string;
  datetime: string;
  day_of_week: number;
  day_of_year: number;
  dst: boolean;
  dst_from: string | null;
  dst_offset: number;
  dst_until: string | null;
  raw_offset: number;
  timezone: string;
  unixtime: number;
  utc_datetime: string;
  utc_offset: string;
  week_number: number;
}

const TIME_API_URL = "https://time.now/developer/api/ip/8.8.8.8";

export async function getSyncedUtcTimestampWithTimezone(): Promise<TimeSyncResult> {
  const response = await fetch(TIME_API_URL);

  if (!response.ok) {
    throw new Error(`Time API request failed with status ${response.status}`);
  }

  const data: WorldTimeApiResponse = await response.json();

  return {
    utcTimestamp: data.unixtime * 1000,
    timezone: data.timezone,
  };
}
