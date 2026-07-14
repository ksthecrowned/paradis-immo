import { OwnerPropertyForm } from '../../owner-property-form';
import { ApiError } from '@/lib/api';
import { getProperty } from '@/lib/owner/properties';
import { notFound } from 'next/navigation';

async function loadInitial(
  id: string,
): Promise<{ initial: Record<string, unknown> } | { notFound: true }> {
  try {
    const property = await getProperty(id);
    return {
      initial: {
        title: property.title,
        description: property.description,
        type: property.type,
        mode: property.mode,
        price: String(property.price),
        currency: property.currency,
        priceUnit: property.priceUnit,
        address: property.address,
        bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
        bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
        surface: property.surface != null ? String(property.surface) : '',
        visitEnabled: property.visitEnabled,
        visitType: property.visitType ?? 'FREE',
        visitPrice: property.visitPrice != null ? String(property.visitPrice) : '',
        visitDuration: String(property.visitDuration ?? 30),
        quartierId: property.quartier.id,
        arrondissementId: property.quartier.arrondissement.id,
        cityId: property.quartier.arrondissement.city.id,
      },
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { notFound: true };
    }
    throw err;
  }
}

export default async function OwnerPropertyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const result = await loadInitial(id);
  if ('notFound' in result) {
    notFound();
  }
  return (
    <OwnerPropertyForm
      propertyId={id}
      initial={result.initial as never}
      submitLabel="Enregistrer"
    />
  );
}
