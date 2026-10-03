/**
 * Make user text safe for use inside a PostgREST `ilike` pattern / `or()` filter:
 * drop the characters that have meaning there (wildcards, commas, parentheses,
 * quotes, backslashes), collapse whitespace, cap the length.
 * Returns "" when nothing searchable is left.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[%_*,()"'\\:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export const MIN_SEARCH_LENGTH = 2;
