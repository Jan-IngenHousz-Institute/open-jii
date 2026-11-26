import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

const READER_FILE = resolve(__dirname, "../../../../packages/database/test-store/reader.json");

const reader = z
  .object({
    views: z.array(z.string()),
    tables: z.array(z.string()),
    rowFilter: z.string(),
    settings: z.array(z.string()),
  })
  .parse(JSON.parse(readFileSync(READER_FILE, "utf-8")));

/**
 * The access the serving store module gives the backend's reader, as the test store's reader has
 * it: the views, and the tables under them read only for the experiment a read names. The data
 * tests check the file against the module.
 */
export const STORE_READER_ACCESS = {
  views: reader.views,
  tables: reader.tables,
  rowFilter: reader.rowFilter,
};

/** The reader's settings profile as users.xml writes it, its parent's first, its limits fixed. */
export const STORE_READER_PROFILE = reader.settings.join(", ");
