'use client';

import { useCallback, useState } from 'react';
import { useApiKeyMetadata } from '@/api/hooks/use-tenant';
import { RotateKeyModal } from '@/components/api-keys/rotate-key-modal';
import { Button, ErrorBoundary, PageHeader, SkeletonRows } from '@ledger/ui';
import { RefreshCw } from 'lucide-react';
import { API_KEY_COPY, COPY } from '@/constants/copy';

function ApiKeyMetaSection({ onRotate }: { onRotate: () => void }) {
  const { data, isPending, isError } = useApiKeyMetadata();

  // Throwing here is what lets the parent <ErrorBoundary> catch it.
  if (isError) throw new Error('Failed to load API key metadata');
  if (isPending) return <SkeletonRows count={2} />;

  return (
    <div className="bg-card space-y-4 rounded-xl border p-6 shadow-sm">
      <div className="text-muted-foreground flex gap-6 text-sm">
        <span>
          Last used:{' '}
          <strong className="text-foreground">
            {data?.lastUsedAt ? new Date(data.lastUsedAt).toLocaleDateString() : 'Never'}
          </strong>
        </span>
        <span>
          Expires:{' '}
          <strong className="text-foreground">
            {data?.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : '—'}
          </strong>
        </span>
      </div>

      <p className="text-muted-foreground text-sm">{COPY.apiKeys.description}</p>

      <Button variant="destructive" onClick={onRotate}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {API_KEY_COPY.rotateButton}
      </Button>
    </div>
  );
}

export default function ApiKeysPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const handleOpenModal = useCallback(() => setModalOpen(true), []);
  const handleCloseModal = useCallback(() => setModalOpen(false), []);

  return (
    <div className="space-y-6">
      <PageHeader title="API Key" />

      <ErrorBoundary title="Couldn't load API key details">
        <ApiKeyMetaSection onRotate={handleOpenModal} />
      </ErrorBoundary>

      <RotateKeyModal open={modalOpen} onClose={handleCloseModal} />
    </div>
  );
}
