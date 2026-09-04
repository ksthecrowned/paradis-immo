import { PropertyVisitSlots } from '@/components/properties/property-visit-slots';

export default async function OwnerCreneauxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PropertyVisitSlots propertyId={id} />;
}
