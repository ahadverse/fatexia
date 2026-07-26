// Builds a query string from a filter object, dropping keys the user hasn't set.
// Without this, an untouched filter would send `?status=` and the server's enum
// validation would reject the whole request.
export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
