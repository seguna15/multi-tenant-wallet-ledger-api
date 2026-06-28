"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@ledger/utils";
import { Button } from "../ui/button";

interface LogoutButtonProps {
  onLogout: () => Promise<void>;
  className?: string;
}

export function LogoutButton({ onLogout, className }: LogoutButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await onLogout();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={pending}
      className={cn("flex", className)}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
