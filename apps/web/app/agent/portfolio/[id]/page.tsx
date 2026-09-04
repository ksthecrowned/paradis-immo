import { PropertyDetailView } from '@/components/properties/property-detail-view';

export default async function AgentPortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PropertyDetailView propertyId={id} role="agent" />;
}
