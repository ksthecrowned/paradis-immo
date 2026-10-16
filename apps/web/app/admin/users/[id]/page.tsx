import { AdminUserDetailPage } from './user-detail';

export default async function AdminUserDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <AdminUserDetailPage userId={id} />;
}
