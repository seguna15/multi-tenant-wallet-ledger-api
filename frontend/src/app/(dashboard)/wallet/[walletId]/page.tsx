import { ErrorBoundary } from '@ledger/ui';
import { WalletDetail } from './_components/wallet-detail';

interface Props {
  params: Promise<{ walletId: string }>;
}

export default async function WalletDetailPage({ params }: Props) {
  const { walletId } = await params;
  return (
    <ErrorBoundary title="Couldn't load wallet">
      <WalletDetail walletId={walletId} />
    </ErrorBoundary>
  );
}
