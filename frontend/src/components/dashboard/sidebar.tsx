'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {Wallet, X, ArrowLeftRight, History } from 'lucide-react';
import { cn } from '@ledger/utils';
import { COPY } from '@/constants/copy';

const NAV = [
  { href: '/wallet', label: 'My Wallets', icon: Wallet },
  { href: '/transfer/new', label: COPY.transfers.formTitle, icon: ArrowLeftRight },
  { href: '/transactions', label: 'Transactions', icon: History },
];

interface SidebarProps {
  role: string | null;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'bg-muted fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r transition-transform duration-200 ease-in-out',
          'lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold tracking-tight">Ledger App</span>
          <button onClick={onClose} className="lg:hidden" aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
