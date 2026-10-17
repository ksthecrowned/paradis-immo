import { SetMetadata } from '@nestjs/common';

export const ACCOUNT_RECOVERY_METADATA_KEY = 'accountRecoveryAllowed';

/**
 * Marks a route as reachable by a `DELETED` account (spec 01): the account has
 * 30 days after its deletion to sign back in and cancel. `AppAuthGuard` only
 * lets such an account through routes carrying this marker; window expiry and
 * anonymization are enforced server-side in `UsersService`.
 */
export const AllowAccountRecovery = () =>
  SetMetadata(ACCOUNT_RECOVERY_METADATA_KEY, true);
