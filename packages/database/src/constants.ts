/**
 * System-level constants for the database
 */

/**
 * The UUID of the system owner user.
 * This user is used for reassigning ownership of published content when a user is deleted.
 * The system owner account should be created during database initialization/seeding.
 */
export const SYSTEM_OWNER_ID = "00000000-0000-0000-0000-000000000000";
