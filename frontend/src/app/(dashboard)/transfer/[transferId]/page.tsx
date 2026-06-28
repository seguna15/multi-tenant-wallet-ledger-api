import { TransferDetail } from './_components/transfer-detail';

interface Props {
  params: Promise<{ transferId: string }>;
}

export default async function TransferDetailPage({ params }: Props) {
  const { transferId } = await params;
  return <TransferDetail transferId={transferId} />;
}
