import { SaleAgreementsListPage } from '@/components/sales/sale-agreements-list';
import { ROUTES } from '@/lib/routes';

export default function AgentSaleAgreementsPage(): React.JSX.Element {
  return (
    <SaleAgreementsListPage
      addHref={ROUTES.agent.salesAgreementsAdd}
      detailHref={ROUTES.agent.saleAgreement}
      inquiriesHref={ROUTES.agent.sales}
    />
  );
}
