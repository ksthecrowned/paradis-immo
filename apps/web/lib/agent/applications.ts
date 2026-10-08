/**
 * Agent-side candidatures. Same API as the owner screens (spec 04) — the
 * backend authorises on "can operate the property", not on the role, so the
 * two dashboards share one implementation.
 */
export {
  acceptApplication,
  applicationStatusLabel,
  applicationStatusTone,
  applyToProperty,
  createLeaseFromApplication,
  fetchMyApplications,
  isOpenApplication,
  rejectApplication,
  requestSolvencyCheck,
  setApplicationUnderReview,
  withdrawApplication,
  APPLICATION_STATUS_LABELS,
  OPEN_APPLICATION_STATUSES,
} from '@/lib/owner/applications';

export type {
  ApplicationStatus,
  CreateLeaseOverrides,
  RentalApplication,
} from '@/lib/owner/applications';

export {
  fetchPropertyApplications,
  type ManagedApplicationsQuery,
} from '@/lib/owner/application-queries';