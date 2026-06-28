'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@ledger/utils';
import { Button, Badge } from '@ledger/ui';
import { useWallet, useWalletBalance } from '@/api/hooks/use-wallet';

interface Props {
  walletId: string;
}

export function WalletDetail({ walletId }: Props) {
  const router = useRouter();
  const { data: wallet, isPending: walletPending, isError: walletError } = useWallet(walletId);
  const { data: balance, isPending: balancePending, refetch } = useWalletBalance(walletId);
  const [copied, setCopied] = useState(false);

  if (walletError) throw new Error('Failed to load wallet');

  if (walletPending) return <WalletDetailSkeleton />;
  if (!wallet) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Wallet not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go back
        </Button>
      </div>
    );
  }

  async function copyAccountNumber() {
    await navigator.clipboard.writeText(wallet!.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatted = wallet.accountNumber.length >= 6 && !wallet.accountNumber.includes('-')
    ? `${wallet.accountNumber.slice(0, 4)}-${wallet.accountNumber.slice(4)}`
    : wallet.accountNumber;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-semibold">{wallet.currency} Wallet</h1>
        <Badge
          variant={wallet.isActive ? 'success' : 'secondary'}
          className="ml-auto"
        >
          {wallet.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Balance card */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-1">
        <p className="text-muted-foreground text-sm">Available balance</p>
        {balancePending ? (
          <div className="bg-muted h-10 w-40 animate-pulse rounded" />
        ) : (
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold tabular-nums">
              {balance?.balance.toFixed(2) ?? '—'}
            </p>
            <span className="text-muted-foreground mb-1 text-lg">{wallet.currency}</span>
            {process.env.NODE_ENV === 'development' && balance && (
              <Badge
                variant={balance.cached ? 'info' : 'warning'}
                className="mb-1 ml-auto"
              >
                {balance.cached ? 'cache hit' : 'live'}
              </Badge>
            )}
          </div>
        )}
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs underline-offset-2 hover:underline"
        >
          Refresh balance
        </button>
      </div>

      {/* Account number */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Account number</p>
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xl font-semibold tracking-widest">{formatted}</p>
          <Button variant="outline" size="sm" onClick={copyAccountNumber}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-3 text-sm">
        
        <Row label="Currency" value={wallet.currency} />
        <Row
          label="Created"
          value={new Date(wallet.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/transactions/${walletId}`)}
      >
        View transactions →
      </Button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('truncate text-right', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function WalletDetailSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-6 animate-pulse">
      <div className="bg-muted h-8 w-48 rounded" />
      <div className="rounded-2xl border p-6 space-y-3">
        <div className="bg-muted h-4 w-24 rounded" />
        <div className="bg-muted h-10 w-48 rounded" />
      </div>
      <div className="rounded-2xl border p-6 space-y-3">
        <div className="bg-muted h-4 w-28 rounded" />
        <div className="bg-muted h-8 w-40 rounded" />
      </div>
    </div>
  );
}
