"use client";

import { Button } from "../ui/button";

interface CursorPaginationProps {
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading?: boolean;
}

export function CursorPagination({
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  isLoading,
}: CursorPaginationProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious || isLoading}
      >
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!hasNext || isLoading}
      >
        Next
      </Button>
    </div>
  );
}
