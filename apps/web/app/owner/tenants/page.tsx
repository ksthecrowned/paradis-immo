import { TenantsListPage } from '@/components/tenants/tenants-list-page';
import { ROUTES } from '@/lib/routes';

export default function Page(): React.JSX.Element {
  return <TenantsListPage tenantBasePath={ROUTES.owner.tenants} />;
}
