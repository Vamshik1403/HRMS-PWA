import { TableCell, TableRow } from "@/app/components/ui/table";

interface TableBodySkeletonProps {
  cols: number;
  rows?: number;
}

/** Shimmer placeholder rows for table bodies while list data loads. */
export function TableBodySkeleton({ cols, rows = 8 }: TableBodySkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, c) => (
            <TableCell key={c}>
              <div
                className={`h-3.5 rounded-full skeleton-shimmer ${
                  c === 0 ? "w-32" : c === 1 ? "w-24" : "w-20"
                }`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Full-width card/table area skeleton when the table wrapper is not used. */
export function ListAreaSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`h-3.5 rounded-full skeleton-shimmer ${i % 3 === 0 ? "w-full" : "w-4/5"}`}
        />
      ))}
    </div>
  );
}
