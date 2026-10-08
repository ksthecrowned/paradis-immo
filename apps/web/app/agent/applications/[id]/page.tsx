import { ApplicationsBoardPage } from '@/components/applications/applications-board-page';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ApplicationsBoardPage propertyId={id} scope="agent" />;
}
