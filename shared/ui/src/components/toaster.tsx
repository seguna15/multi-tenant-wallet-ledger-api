"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "next-themes";


/**
 * Mount once per app, in the root layout. Follows the OS color scheme so
 * toasts match light/dark mode automatically.
 */
export function Toaster() {

    const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme as "light" | "dark" | "system"}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border bg-background text-foreground shadow-lg",
        },
      }}
    />
  );
}
