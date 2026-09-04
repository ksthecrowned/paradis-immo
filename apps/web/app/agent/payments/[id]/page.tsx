import { PaymentDetail } from '@/components/payments/payment-detail';

export default async function AgentPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PaymentDetail paymentId={id} role="agent" />;
}
