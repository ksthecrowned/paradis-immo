import { OwnerPropertyDetail } from './owner-property-detail';

export default async function OwnerBienDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerPropertyDetail propertyId={id} />;
}
