import { SaleAgreementsListPage } from '@/components/sales/sale-agreements-list';
import { ROUTES } from '@/lib/routes';

export default function AgentSaleAgreementsPage(): React.JSX.Element {
  return (
    <SaleAgreementsListPage
      addHref={ROUTES.agent.salesAgreementsAdd}
      detailBasePath={ROUTES.agent.salesAgreements}
      inquiriesHref={ROUTES.agent.sales}
    />
  );
}
