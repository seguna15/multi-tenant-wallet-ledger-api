'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { ApiError, toFriendlyMessage } from '@ledger/utils';
import { Button, toast, useDialogFocus } from '@ledger/ui';
import { useRotateApiKey } from '@/api/hooks/use-tenant';
import { API_KEY_COPY } from '@/constants/copy';

interface RotateKeyModalProps {
  open: boolean;
  onClose: () => void;
}

export function RotateKeyModal({ open, onClose }: RotateKeyModalProps) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { mutate, isPending, error } = useRotateApiKey();

  async function handleCopy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setNewKey(null);
    setCopied(false);
    onClose();
  }

  const containerRef = useDialogFocus<HTMLDivElement>(open, handleClose);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotate-key-modal-title"
    >
      <div className="bg-background w-full max-w-md space-y-5 rounded-xl border p-6 shadow-lg">
        {!newKey ? (
          <>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <h2 id="rotate-key-modal-title" className="text-base font-semibold">
                  {API_KEY_COPY.rotateDialog.title}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {API_KEY_COPY.rotateDialog.description}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm">
                {error instanceof ApiError && error.correlationId
                  ? `${toFriendlyMessage(error)} (Ref: ${error.correlationId})`
                  : toFriendlyMessage(error)}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose} disabled={isPending}>
                {API_KEY_COPY.rotateDialog.cancel}
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() =>
                  mutate(undefined, {
                    onSuccess: ({ apiKey }) => {
                      toast.success('API key rotated.');
                      setNewKey(apiKey);
                    },
                    onError: (error) =>
                      toast.error('Failed to rotate API key', toFriendlyMessage(error)),
                  })
                }
              >
                {isPending ? 'Rotating…' : API_KEY_COPY.rotateDialog.confirm}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h2 id="rotate-key-modal-title" className="text-base font-semibold">
                {API_KEY_COPY.revealDialog.title}
              </h2>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>{API_KEY_COPY.revealDialog.description}</p>
            </div>

            <div className="bg-muted flex items-center gap-2 rounded-md border px-3 py-2.5">
              <code className="flex-1 font-mono text-xs break-all select-all">{newKey}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
                aria-label={API_KEY_COPY.revealDialog.copyButton}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex justify-end">
              {/* No signOut here — the dashboard uses JWT + a static env key,
                  not this rotatable key. Session is unaffected by rotation. */}
              <Button onClick={handleClose}>{API_KEY_COPY.revealDialog.doneButton}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
