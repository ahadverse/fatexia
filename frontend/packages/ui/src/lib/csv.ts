/**
 * Downloads a CSV of what is already on screen, rather than re-querying the server —
 * so the file always matches the numbers the reader was looking at when they clicked.
 *
 * Shared because the Admin and Affiliate report pages had a near-verbatim copy each,
 * and a quoting fix applied to one would silently not reach the other.
 */
export function downloadCsv(filename: string, header: string[], body: (string | number)[][]): void {
  // Quote every cell and double any embedded quotes — an offer named
  // `Acme "Instant" Card, US` would otherwise split into extra columns.
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
