import { OwnerPropertyDetailView } from './owner-property-detail-view';

export default async function OwnerBienDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerPropertyDetailView propertyId={id} />;
}
