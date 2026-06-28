"use client";

import { useCallback, useState } from "react";

export function useCursorFilters<TFilters extends Record<string, string>>(
  initialFilters: TFilters,
) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const resetPaging = useCallback(() => setCursorStack([]), []);

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setCursorStack([]);
    },
    [],
  );

  const goToNextPage = useCallback((nextCursor?: string | null) => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, nextCursor]);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setCursorStack((prev) => prev.slice(0, -1));
  }, []);

  return {
    filters,
    setFilter,
    cursor: cursorStack[cursorStack.length - 1],
    hasPreviousPage: cursorStack.length > 0,
    resetPaging,
    goToNextPage,
    goToPreviousPage,
  };
}
