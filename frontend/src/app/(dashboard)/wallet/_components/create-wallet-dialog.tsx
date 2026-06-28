'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError, toFriendlyMessage } from '@ledger/utils';
import { Button, Spinner, toast, useDialogFocus } from '@ledger/ui';
import { useCreateWallet } from '@/api/hooks/use-wallet';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'JPY', 'AUD', 'CAD', 'CNY'] as const;

const schema = z.object({
  currency: z.enum(CURRENCIES, { error: 'Select a currency' }),
});

type FormValues = z.infer<typeof schema>;

export function CreateWalletDialog() {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateWallet();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const handleClose = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  const containerRef = useDialogFocus<HTMLDivElement>(open, handleClose);

    function onSubmit(values: FormValues) {
    mutate(values.currency, {
      onSuccess: () => {
        toast.success('Wallet created successfully.');
        reset();
        setOpen(false);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.correlationId) {
          setError('root', {
            message: `${toFriendlyMessage(error)} (Ref: ${error.correlationId})`,
          });
        } else {
          setError('root', { message: toFriendlyMessage(error) });
        }
      },
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + New Wallet
      </Button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-wallet-title"
    >
      <div className="bg-card w-full max-w-sm rounded-2xl border p-6 shadow-lg">
        <h2 id="create-wallet-title" className="mb-4 text-lg font-semibold">
          Create Wallet
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="currency" className="text-sm font-medium">
              Currency
            </label>
            <select
              id="currency"
              aria-invalid={!!errors.currency}
              aria-describedby={errors.currency ? 'currency-error' : undefined}
              {...register('currency')}
              className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              <option value="">Select currency…</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.currency && (
              <p id="currency-error" className="text-destructive text-xs">
                {errors.currency.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p role="alert" className="text-destructive text-xs">
              {errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? <Spinner className="mr-2 h-4 w-4" /> : null}
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
