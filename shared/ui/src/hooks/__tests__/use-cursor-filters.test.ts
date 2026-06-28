// Tests for useCursorFilters (shared/ui/src/hooks/use-cursor-filters.ts).
//
// This hook backs every cursor-paginated list in the dashboard/frontend apps.
// It tracks a stack of page cursors (so "previous page" can pop back to the
// prior cursor) plus a `filters` object, with the critical invariant that
// changing a filter must reset paging — otherwise you could end up applying
// a stale cursor to a different filtered result set.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCursorFilters } from '../use-cursor-filters';

describe('useCursorFilters', () => {
  it('starts with the given filters, no cursor, and no previous page', () => {
    const { result } = renderHook(() => useCursorFilters({ status: 'ALL' }));

    expect(result.current.filters).toEqual({ status: 'ALL' });
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('goToNextPage pushes a cursor and marks a previous page as available', () => {
    const { result } = renderHook(() => useCursorFilters({ status: 'ALL' }));

    act(() => result.current.goToNextPage('cursor-1'));

    expect(result.current.cursor).toBe('cursor-1');
    expect(result.current.hasPreviousPage).toBe(true);
  });

  it('goToNextPage with null/undefined is a no-op (no next page exists)', () => {
    const { result } = renderHook(() => useCursorFilters({ status: 'ALL' }));

    act(() => result.current.goToNextPage(null));

    expect(result.current.cursor).toBeUndefined();
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('goToPreviousPage pops back to the prior cursor', () => {
    const { result } = renderHook(() => useCursorFilters({ status: 'ALL' }));

    act(() => result.current.goToNextPage('cursor-1'));
    act(() => result.current.goToNextPage('cursor-2'));
    expect(result.current.cursor).toBe('cursor-2');

    act(() => result.current.goToPreviousPage());
    expect(result.current.cursor).toBe('cursor-1');
    expect(result.current.hasPreviousPage).toBe(true);

    act(() => result.current.goToPreviousPage());
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('setFilter updates the filter value and resets paging back to page 1', () => {
    const { result } = renderHook(() => useCursorFilters({ status: 'ALL' }));

    act(() => result.current.goToNextPage('cursor-1'));
    expect(result.current.hasPreviousPage).toBe(true);

    act(() => result.current.setFilter('status', 'COMPLETED'));

    expect(result.current.filters).toEqual({ status: 'COMPLETED' });
    // Without this reset, "previous page" would apply a cursor from the
    // old filter's result set to the newly filtered list.
    expect(result.current.cursor).toBeUndefined();
    expect(result.current.hasPreviousPage).toBe(false);
  });
});
