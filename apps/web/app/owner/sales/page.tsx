import { SaleAgreementsListPage } from '@/components/sales/sale-agreements-list';
import { ROUTES } from '@/lib/routes';

export default function OwnerSalesPage(): React.JSX.Element {
  return (
    <SaleAgreementsListPage
      addHref={ROUTES.owner.salesAdd}
      detailBasePath={ROUTES.owner.sales}
    />
  );
}
