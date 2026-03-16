"use client";

import { useEffect, useState, FC, useCallback, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RefreshCw, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface LogEntry {
  log_data:   any;
  response:   any;
  created_at: string;
}

const PAGE_SIZE = 20;

function getMethodClass(method: string): string {
  switch (method?.toUpperCase()) {
    case "GET":    return "text-blue-600 dark:text-blue-400";
    case "POST":   return "text-green-600 dark:text-green-400";
    case "PUT":
    case "PATCH":  return "text-amber-600 dark:text-amber-400";
    case "DELETE": return "text-red-600 dark:text-red-400";
    default:       return "text-muted-foreground";
  }
}

function getStatusClass(status: number): string {
  if (status >= 500) return "text-red-600 dark:text-red-400 font-semibold";
  if (status >= 400) return "text-red-500 dark:text-red-400";
  if (status >= 300) return "text-purple-600 dark:text-purple-400";
  if (status >= 200) return "text-green-600 dark:text-green-400";
  return "text-muted-foreground";
}

function getRowClass(status: number): string {
  if (status >= 500) return "bg-red-50/40 dark:bg-red-950/10";
  if (status >= 400) return "bg-amber-50/40 dark:bg-amber-950/10";
  return "";
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now  = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    day:    "numeric",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  if (date.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }
  return new Intl.DateTimeFormat("en-GB", opts).format(date);
}

function safeString(val: any): string {
  return typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
}

const LogViewer: FC = () => {
  const [logs,           setLogs]           = useState<LogEntry[]>([]);
  const [total,          setTotal]          = useState(0);
  const [hasMore,        setHasMore]        = useState(false);
  const [offset,         setOffset]         = useState(0);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  const [expandedIndex,  setExpandedIndex]  = useState<number | null>(null);

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const fetchLogs = useCallback(
    async (currentOffset: number, replace: boolean) => {
      if (!userId) return;
      try {
        const res = await fetch(
          `/api/${userId}/scim/v2/logs?limit=${PAGE_SIZE}&offset=${currentOffset}`,
        );
        if (!res.ok) { toast.error("Failed to fetch logs."); return; }
        const { logs: newLogs, total: newTotal, hasMore: newHasMore } = await res.json();
        setLogs((prev) => (replace ? newLogs : [...prev, ...newLogs]));
        setTotal(newTotal);
        setHasMore(newHasMore);
        setOffset(currentOffset + newLogs.length);
        if (replace) setExpandedIndex(null);
      } catch {
        toast.error("Error fetching logs.");
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    fetchLogs(0, true).finally(() => setIsLoading(false));
  }, [userId, fetchLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setOffset(0);
    await fetchLogs(0, true);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    setIsFetchingMore(true);
    await fetchLogs(offset, false);
    setIsFetchingMore(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : total === 0
              ? "No logs recorded yet"
              : `Showing ${logs.length} of ${total} request${total !== 1 ? "s" : ""}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-hidden">
          <Table className="min-w-[600px] table-fixed w-full">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-9" />
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-20">Method</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-20">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Endpoint</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide hidden lg:table-cell">User Agent</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-28 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell />
                    <TableCell><div className="h-4 w-10 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-10 rounded bg-muted" /></TableCell>
                    <TableCell><div className="h-4 w-48 rounded bg-muted" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><div className="h-4 w-32 rounded bg-muted" /></TableCell>
                    <TableCell><div className="ml-auto h-4 w-16 rounded bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, index) => {
                  const status   = log.response?.status?.status;
                  const isExpanded = expandedIndex === index;
                  return (
                    <Fragment key={index}>
                      <TableRow
                        onClick={() => setExpandedIndex(isExpanded ? null : index)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/40",
                          !isExpanded && getRowClass(status),
                          isExpanded && "bg-muted/20",
                        )}
                      >
                        <TableCell className="pl-3 text-muted-foreground">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </TableCell>

                        <TableCell className={cn("font-mono text-xs font-semibold", getMethodClass(log.log_data.method))}>
                          {safeString(log.log_data.method)}
                        </TableCell>

                        <TableCell className={cn("font-mono text-xs font-semibold tabular-nums", getStatusClass(status))}>
                          {status ?? "—"}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-foreground/80 truncate max-w-[240px]">
                          {safeString(log.log_data.url)}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[220px]">
                          {safeString(log.log_data.userAgent)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(log.created_at)}
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={6} className="p-0 border-t border-border/60 overflow-hidden">
                            <div className="px-4 py-3 overflow-hidden w-full">
                              <Tabs defaultValue="request">
                                <TabsList className="h-7">
                                  <TabsTrigger value="request"  className="text-xs h-6 px-2 gap-1.5">
                                    <ArrowDownLeft className="h-3 w-3" />Request
                                  </TabsTrigger>
                                  <TabsTrigger value="response" className="text-xs h-6 px-2 gap-1.5">
                                    <ArrowUpRight className="h-3 w-3" />Response
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="request"  className="mt-2">
                                  <JsonViewer data={log.log_data}   className="max-h-[320px]" />
                                </TabsContent>
                                <TabsContent value="response" className="mt-2">
                                  <JsonViewer data={log.response}   className="max-h-[320px]" />
                                </TabsContent>
                              </Tabs>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isFetchingMore}
            className="min-w-[160px] gap-1.5"
          >
            {isFetchingMore
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
              : `Load more (${total - logs.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default LogViewer;
