/**
 * TableSkeleton — replaces "Loading..." text in tables with animated
 * placeholder rows so the page never shows a blank content area.
 *
 * Usage:
 *   {loading ? <TableSkeleton cols={7} rows={8} /> : <ActualRows />}
 */

interface TableSkeletonProps {
  /** Number of columns (matches the table's <colSpan>) */
  cols?: number;
  /** Number of placeholder rows to show */
  rows?: number;
  /** Show a header row of grey blobs */
  showHeader?: boolean;
}

function SkeletonCell({ wide = false }: { wide?: boolean }) {
  return (
    <td className="px-4 py-3">
      <div
        className={`h-3.5 rounded-full bg-gray-200 animate-pulse ${wide ? "w-3/4" : "w-1/2"}`}
      />
    </td>
  );
}

export function TableSkeleton({
  cols = 5,
  rows = 8,
  showHeader = false,
}: TableSkeletonProps) {
  return (
    <>
      {showHeader && (
        <tr className="border-b border-gray-100">
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <div className="h-3 w-16 rounded-full bg-gray-200 animate-pulse" />
            </th>
          ))}
        </tr>
      )}
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-50">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonCell key={c} wide={c === 1} />
          ))}
        </tr>
      ))}
    </>
  );
}
