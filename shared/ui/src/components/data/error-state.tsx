"use client";

import { Button } from "../ui/button";

interface ErrorStateProps {
  title: string;
  onRetry: () => void;
}

export function ErrorState({ title, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Something went wrong. Try refreshing.
      </p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
