// Beyond this silence, a connected device counts as online but not delivering.
// A fixed threshold until cadence inference exists; shared by the device tiles
// and the group health rollup so both verdicts always agree.
export const SILENT_THRESHOLD_MS = 3_600_000;
