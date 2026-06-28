'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Key,
  Webhook,
  Settings,
  Users,
  Building2,
  PlusCircle,
  History,
  Wallet,
  AlertTriangle,
  X,
} from 'lucide-react';
import { cn } from '@ledger/utils';

const NAV_TENANT_ADMIN = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: History },
  { href: '/wallets', label: 'Wallets', icon: Wallet },
  { href: '/api-keys', label: 'API Keys', icon: Key },
  { href: '/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dlq', label: 'Failed Events', icon: AlertTriangle },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/users', label: 'Users', icon: Users },
];

const NAV_SYSTEM_ADMIN = [
  { href: '/tenants', label: 'All Tenants', icon: Building2 },
  { href: '/tenants/new', label: 'Create Tenant', icon: PlusCircle },
];

interface SidebarProps {
  role: string | null;
  open: boolean;
  onClose: () => void;
}


export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const nav =
    role === 'SYSTEM_ADMIN' ? NAV_SYSTEM_ADMIN : role === 'TENANT_ADMIN' ? NAV_TENANT_ADMIN : [];

  const activeHref = nav
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

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
          <div className="flex items-center">
            <span className="text-sm font-semibold tracking-tight">Ledger</span>
            {role === 'SYSTEM_ADMIN' && (
              <span className="bg-primary text-primary-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium">
                ADMIN
              </span>
            )}
          </div>
          <button onClick={onClose} className="lg:hidden" aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                href === activeHref
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
