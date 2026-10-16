import { AdminReportDetailPage } from './admin-report-detail';

export default async function AdminReportDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <AdminReportDetailPage reportId={id} />;
}
