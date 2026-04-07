"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  PaginationState,
} from "@tanstack/react-table";
import { Fragment, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  totalCount: number;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  renderExpandedRow?: (row: TData) => React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  totalCount,
  pagination,
  setPagination,
  renderExpandedRow,
}: DataTableProps<TData, TValue>) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
    onPaginationChange: setPagination,
    state: { pagination },
  });

  const rows = table.getRowModel().rows;
  const from = pagination.pageIndex * pagination.pageSize + 1;
  const to   = Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted dark:bg-white/[0.04]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {renderExpandedRow && <TableHead className="w-9" />}
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-semibold uppercase tracking-wide">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row, index) => (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    onClick={renderExpandedRow ? () => setExpandedIndex(expandedIndex === index ? null : index) : undefined}
                    className={cn(renderExpandedRow && "cursor-pointer hover:bg-muted/40 transition-colors")}
                  >
                    {renderExpandedRow && (
                      <TableCell className="pl-3 text-muted-foreground">
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform duration-150",
                            expandedIndex === index && "rotate-90",
                          )}
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderExpandedRow && expandedIndex === index && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell
                        colSpan={columns.length + 1}
                        className="p-0 border-t border-border/60"
                      >
                        <div className="px-5 py-4">
                          {renderExpandedRow(row.original)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderExpandedRow ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount > 0 ? `Showing ${from}–${to} of ${totalCount}` : "No results"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums px-1">
            Page {pagination.pageIndex + 1} of {Math.max(pageCount, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
