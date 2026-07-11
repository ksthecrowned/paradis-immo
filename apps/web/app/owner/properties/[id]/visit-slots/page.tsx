import { OwnerVisitSlots } from './owner-visit-slots';

export default async function OwnerCreneauxPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerVisitSlots propertyId={id} />;
}
