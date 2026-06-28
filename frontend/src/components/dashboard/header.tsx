'use client';

import { Menu } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { ThemeToggle } from '@ledger/ui';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden" aria-label="Open sidebar">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
