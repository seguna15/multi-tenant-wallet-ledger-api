'use client';

import { useState } from 'react';
import { Button, toast } from '@ledger/ui';
import { toFriendlyMessage } from '@ledger/utils';
import { useReplayDlqEvent, type DlqEvent } from '@/api/hooks/use-dlq';

export function ReplayButton({ event }: { event: DlqEvent }) {
  const [confirming, setConfirming] = useState(false);
  const { mutate, isPending, error } = useReplayDlqEvent();

  if (event.replayedAt) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() =>
            mutate(event.id, {
              onSuccess: () => {
                toast.success('DLQ event replayed successfully.');
                setConfirming(false);
              },
              onError: (error) => toast.error('Replay failed', toFriendlyMessage(error)),
            })
          }
        >
          {isPending ? 'Replaying…' : 'Confirm'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Replay
      </Button>
      {error && <p className="text-destructive text-xs">{toFriendlyMessage(error)}</p>}
    </div>
  );
}
