import { PropertyDetailView } from '@/components/properties/property-detail-view';

export default async function OwnerBienDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PropertyDetailView propertyId={id} />;
}
