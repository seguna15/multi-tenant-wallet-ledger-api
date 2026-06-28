'use client';

import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn, fromSmallestUnit, formatAccountNumber } from '@ledger/utils';
import type { Currency } from '@ledger/utils';
import { Badge, Button } from '@ledger/ui';
import { useTransferStream, TERMINAL_STATUSES } from '@/api/hooks/use-transfer';
import type { TransferStatus } from '@ledger/types';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_STEPS: TransferStatus[] = ['INITIATED', 'PROCESSING', 'COMPLETED'];

const STATUS_LABELS: Record<TransferStatus, string> = {
  INITIATED: 'Initiated',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const BADGE_VARIANT: Record<
  TransferStatus,
  'default' | 'secondary' | 'success' | 'destructive'
> = {
  INITIATED: 'secondary',
  PROCESSING: 'default',
  COMPLETED: 'success',
  FAILED: 'destructive',
};

function stepState(
  step: TransferStatus,
  current: TransferStatus,
): 'done' | 'active' | 'pending' | 'failed' {
  const normalSteps: TransferStatus[] = ['INITIATED', 'PROCESSING', 'COMPLETED'];
  const isTerminalFail = current === 'FAILED';

  if (step === 'COMPLETED' && isTerminalFail) return 'failed';

  const effectiveCurrent = isTerminalFail ? 'PROCESSING' : current;
  const currentIdx = normalSteps.indexOf(effectiveCurrent);
  const stepIdx = normalSteps.indexOf(step);

  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

function formatAmount(smallestUnit: string, currency: string): string {
  const value = fromSmallestUnit(BigInt(smallestUnit), currency as Currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  transferId: string;
}

export function TransferDetail({ transferId }: Props) {
  const router = useRouter();
  const { data: transfer, isPending, isError } = useTransferStream(transferId);

  const isLive = transfer && !TERMINAL_STATUSES.has(transfer.status);

  if (isPending) return <Skeleton />;

  if (isError || !transfer) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Transfer not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  const isCrossCurrency = transfer.fromCurrency !== transfer.toCurrency;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Transfer Details</h1>
        <div className="ml-auto flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-blue-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live
            </span>
          )}
          <Badge variant={BADGE_VARIANT[transfer.status]} data-testid="transfer-status-badge">
            {STATUS_LABELS[transfer.status]}
          </Badge>
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <p className="text-muted-foreground mb-4 text-sm font-medium">Progress</p>
        <div className="flex items-center">
          {STATUS_STEPS.map((step, i) => {
            const state = stepState(step, transfer.status);
            const isLast = i === STATUS_STEPS.length - 1;

            return (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                      state === 'done' && 'bg-green-500 text-white',
                      state === 'active' && 'border-2 border-blue-500 bg-blue-50 text-blue-600',
                      state === 'pending' && 'bg-muted text-muted-foreground',
                      state === 'failed' && 'bg-destructive/10 text-destructive',
                    )}
                  >
                    {state === 'done' ? '✓' : state === 'failed' ? '✗' : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-center text-xs',
                      state === 'done' && 'text-green-600',
                      state === 'active' && 'font-medium text-blue-600',
                      state === 'pending' && 'text-muted-foreground',
                      state === 'failed' && 'text-destructive',
                    )}
                  >
                    {step === 'COMPLETED' &&
                    (transfer.status === 'FAILED')
                      ? STATUS_LABELS[transfer.status]
                      : STATUS_LABELS[step]}
                  </span>
                </div>

                {!isLast && (
                  <div
                    className={cn(
                      'mx-2 mb-4 h-px flex-1 transition-colors',
                      stepState(STATUS_STEPS[i + 1], transfer.status) !== 'pending'
                        ? 'bg-green-400'
                        : 'bg-muted',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Transfer parties */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <PartyCard
          label="From"
          accountNumber={formatAccountNumber(transfer.walletFrom.accountNumber)}
          amount={formatAmount(transfer.fromAmount, transfer.fromCurrency)}
          currency={transfer.fromCurrency}
        />
        <span className="text-muted-foreground mt-4 text-lg">→</span>
        <PartyCard
          label="To"
          accountNumber={formatAccountNumber(transfer.walletTo.accountNumber)}
          amount={formatAmount(transfer.toAmount, transfer.toCurrency)}
          currency={transfer.toCurrency}
        />
      </div>

      {/* Metadata */}
      <div className="bg-card space-y-3 rounded-2xl border p-6 text-sm shadow-sm">
        <Row label="Transfer ID" value={transfer.id} mono />
        <Row
          label="Date"
          value={new Date(transfer.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
        {isCrossCurrency && (
          <Row
            label="FX Rate"
            value={`1 ${transfer.fromCurrency} = ${Number(transfer.fxRate).toFixed(4)} ${transfer.toCurrency}`}
          />
        )}
        {transfer.idempotencyKey && (
          <Row label="Idempotency Key" value={transfer.idempotencyKey} mono />
        )}
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PartyCard({
  label,
  accountNumber,
  amount,
  currency,
}: {
  label: string;
  accountNumber: string;
  amount: string;
  currency: string;
}) {
  return (
    <div className="bg-card rounded-2xl border p-4 text-center shadow-sm">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="font-mono text-xs font-medium">{accountNumber}</p>
      <p className="mt-2 text-lg font-bold tabular-nums">{amount}</p>
      <p className="text-muted-foreground text-xs">{currency}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('truncate text-right', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-lg animate-pulse space-y-6">
      <div className="bg-muted h-8 w-48 rounded" />
      <div className="rounded-2xl border p-6">
        <div className="bg-muted mb-4 h-4 w-20 rounded" />
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="bg-muted h-7 w-7 rounded-full" />
              {i < 2 && <div className="bg-muted mx-2 h-px flex-1" />}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border p-4">
            <div className="bg-muted mx-auto mb-2 h-3 w-12 rounded" />
            <div className="bg-muted mx-auto h-3 w-24 rounded" />
            <div className="bg-muted mx-auto mt-2 h-6 w-20 rounded" />
          </div>
        ))}
        <div className="bg-muted h-4 w-4 rounded" />
      </div>
    </div>
  );
}
