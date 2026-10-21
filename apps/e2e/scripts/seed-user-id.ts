import { readSeedUserId } from "../helpers.js";

// Printed bare so a shell can pass it to the backend as ADMIN_USER_IDS.
console.log(await readSeedUserId());
