/**
 * Recovery window before anonymization (spec 01): a DELETED account can still
 * cancel the pending deletion for this many days, after which the
 * anonymization cron irreversibly wipes personal data.
 * Single source of truth shared by the cancel check in `UsersService` and the
 * anonymization cron in `AccountDeletionProcessor`.
 */
export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30;
