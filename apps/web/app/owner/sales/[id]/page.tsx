import { SaleAgreementDetailPage } from '@/components/sales/sale-agreement-detail';
import { ROUTES } from '@/lib/routes';

export default async function OwnerSaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <SaleAgreementDetailPage
      agreementId={id}
      listHref={ROUTES.owner.sales}
      paymentsHref={ROUTES.owner.payments}
    />
  );
}
