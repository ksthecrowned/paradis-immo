import { Suspense } from 'react';
import { SaleAgreementFormPage } from '@/components/sales/sale-agreement-form';
import { ROUTES } from '@/lib/routes';

export default function OwnerSaleAddPage(): React.JSX.Element {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Chargement…</p>}>
      <SaleAgreementFormPage
        listHref={ROUTES.owner.sales}
        detailHref={ROUTES.owner.sale}
      />
    </Suspense>
  );
}
