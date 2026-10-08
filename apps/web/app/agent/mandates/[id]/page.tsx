import { AgentMandateDetail } from './agent-mandate-detail';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <AgentMandateDetail mandateId={id} />;
}
