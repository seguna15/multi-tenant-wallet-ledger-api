'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { ApiError, cn, toFriendlyMessage } from '@ledger/utils';
import { Button, toast } from '@ledger/ui';
import { COPY } from '@/constants/copy';
import { useMyWallets } from '@/api/hooks/use-wallet';
import { useCreateTransfer, useResolveWallet } from '@/api/hooks/use-transfer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@ledger/ui';

const schema = z.object({
  walletFromId: z.string().uuid('Select a source wallet'),
  destinationAccountNumber: z.string().min(1, 'Enter an account number'),
  amount: z.coerce
    .number({ error: 'Enter a valid amount' })
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Max 2 decimal places'),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.infer<typeof schema>;

export function InitiateTransferForm() {
  const router = useRouter();
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [debouncedAccountNumber, setDebouncedAccountNumber] = useState('');

  const { data: walletsPage, isLoading: walletsLoading } = useMyWallets();
  const resolveQuery = useResolveWallet(debouncedAccountNumber, true);
  const { mutate: createTransfer, isPending } = useCreateTransfer();

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      walletFromId: '',
      destinationAccountNumber: '',
      amount: '',
    },
  });

  const walletFromId = form.watch('walletFromId');
  const rawAccountNumber = form.watch('destinationAccountNumber');

  useEffect(() => {
    const trimmed = rawAccountNumber?.trim() ?? '';
    if (!trimmed) {
      setDebouncedAccountNumber('');
      return;
    }
    const timer = setTimeout(() => setDebouncedAccountNumber(trimmed), 500);
    return () => clearTimeout(timer);
  }, [rawAccountNumber]);

  const selectedSourceWallet = useMemo(
    () => walletsPage?.items.find((w) => w.id === walletFromId),
    [walletsPage?.items, walletFromId],
  );

  const isResolving = debouncedAccountNumber.length > 0 && resolveQuery.isFetching;
  const isResolved = !!resolveQuery.data && !resolveQuery.isFetching && !resolveQuery.isError;
  const isResolveFailed =
    resolveQuery.isError && !resolveQuery.isFetching && debouncedAccountNumber.length > 0;
  const isSelfTransfer = isResolved && resolveQuery.data?.walletId === walletFromId;
  const isCrossCurrency =
    isResolved &&
    !!selectedSourceWallet &&
    selectedSourceWallet.currency !== resolveQuery.data?.currency;

  const canSubmit = isResolved && !isSelfTransfer && form.formState.isValid && !isPending;

  const handleSubmit = useCallback(
    (values: FormValues) => {
      if (!resolveQuery.data?.walletId) return;
      form.clearErrors('root');

      createTransfer(
        {
          walletFromId: values.walletFromId,
          walletToId: resolveQuery.data.walletId,
          amount: values.amount,
          idempotencyKey: idempotencyKeyRef.current,
        },
        {
          onSuccess: (transfer) => {
            toast.success('Transfer initiated successfully.');
            router.push(`/transfer/${transfer.id}`);
          },
          onError: (error) => {
            idempotencyKeyRef.current = crypto.randomUUID(); // fresh key on retry
            if (error instanceof ApiError && error.correlationId) {
              form.setError('root', {
                message: `${toFriendlyMessage(error)} (Ref: ${error.correlationId})`,
              });
            } else {
              form.setError('root', { message: toFriendlyMessage(error) });
            }
          },
        },
      );
    },
    [resolveQuery.data, createTransfer, router, form],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Source wallet */}
        <FormField
          control={form.control}
          name="walletFromId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>From Wallet</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger disabled={walletsLoading}>
                    <SelectValue
                      placeholder={walletsLoading ? 'Loading wallets…' : 'Select a wallet'}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {walletsPage?.items
                    .filter((w) => w.isActive)
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.currency} · {w.accountNumber}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Destination account number */}
        <FormField
          control={form.control}
          name="destinationAccountNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination Account Number</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. TN-a1b2c3-X9Y8Z7W6"
                    autoComplete="off"
                    spellCheck={false}
                    className={cn(
                      'pr-9',
                      isResolved &&
                        !isSelfTransfer &&
                        'border-green-500 focus-visible:ring-green-500',
                      (isResolveFailed || isSelfTransfer) &&
                        'border-destructive focus-visible:ring-destructive',
                    )}
                  />
                </FormControl>
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                  {isResolving && (
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  )}
                  {isResolved && !isSelfTransfer && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {(isResolveFailed || isSelfTransfer) && (
                    <XCircle className="text-destructive h-4 w-4" />
                  )}
                </span>
              </div>

              {isResolved && !isSelfTransfer && resolveQuery.data && (
                <p className="text-sm text-green-600">
                  Resolved — {resolveQuery.data.currency} wallet
                </p>
              )}
              {isSelfTransfer && (
                <p className="text-destructive text-sm">Cannot transfer to your own wallet</p>
              )}
              {isResolveFailed && (
                <p className="text-destructive text-sm">{COPY.transfers.unresolvedAccount}</p>
              )}
              {isCrossCurrency && (
                <p className="flex items-center gap-1 text-sm text-amber-600">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Cross-currency — FX rate applied automatically
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Amount
                {selectedSourceWallet && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({selectedSourceWallet.currency})
                  </span>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as string | number}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit error */}
        {form.formState.errors.root && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit} className="w-full">
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Sending…
            </>
          ) : (
            'Send Transfer'
          )}
        </Button>
      </form>
    </Form>
  );
}
