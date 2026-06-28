'use client';

import { Button } from '@ledger/ui';

export default function TransferError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="font-medium">Failed to load transfer</p>
      <p className="text-muted-foreground mt-1 text-sm">Something went wrong. Try refreshing.</p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
