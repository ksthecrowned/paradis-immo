import { AdminOnboardingDetailPage } from './admin-onboarding-detail';

export default async function AdminOnboardingDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <AdminOnboardingDetailPage requestId={id} />;
}
