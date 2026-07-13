import { OwnerPaymentDetail } from './owner-payment-detail';

export default async function OwnerPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerPaymentDetail paymentId={id} />;
}
