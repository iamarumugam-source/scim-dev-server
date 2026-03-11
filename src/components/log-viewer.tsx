"use client";

import { useEffect, useState, FC, useCallback, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonViewer } from "@/components/json-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface LogEntry {
  log_data: any;
  response: any;
}

const PAGE_SIZE = 20;

const getMethodBadgeVariant = (method: string) => {
  switch (method?.toUpperCase()) {
    case "GET":
      return "bg-blue-500 hover:bg-blue-500 font-semibold text-white";
    case "POST":
      return "bg-green-600 hover:bg-green-600 font-semibold text-white";
    case "PUT":
    case "PATCH":
      return "bg-yellow-500 hover:bg-yellow-500 font-semibold text-black";
    case "DELETE":
      return "bg-red-600 hover:bg-red-600 font-semibold text-white";
    default:
      return "bg-gray-500 hover:bg-gray-500 font-semibold text-white";
  }
};

const getStatusBadgeClass = (status: number) => {
  if (status >= 500) return "bg-red-600 text-white";
  if (status >= 400) return "bg-yellow-500 text-black";
  if (status >= 300) return "bg-blue-500 text-white";
  if (status >= 200) return "bg-green-600 text-white";
  return "bg-gray-500 text-white";
};

function formatTimestamp(ts: string | number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeString(val: any): string {
  return typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
}

const LogViewer: FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const { data: session } = useSession();
  const userId = session?.user?.id;
  const fetchLogs = useCallback(
    async (currentOffset: number, replace: boolean) => {
      if (!userId) return;
      try {
        const res = await fetch(
          `/api/${userId}/scim/v2/logs?limit=${PAGE_SIZE}&offset=${currentOffset}`,
        );
        if (!res.ok) {
          toast.error("Failed to fetch logs.");
          return;
        }
        const {
          logs: newLogs,
          total: newTotal,
          hasMore: newHasMore,
        } = await res.json();

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

  const toggleExpansion = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : total === 0
              ? "No logs yet"
              : `Showing ${logs.length} of ${total} log${total !== 1 ? "s" : ""}`}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-9" />
                <TableHead className="w-20">Method</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead className="hidden lg:table-cell">
                  User Agent
                </TableHead>
                <TableHead className="w-28 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell />
                    <TableCell>
                      <div className="h-5 w-14 rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-5 w-14 rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-48 rounded bg-muted" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-4 w-32 rounded bg-muted" />
                    </TableCell>
                    <TableCell>
                      <div className="ml-auto h-4 w-16 rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log, index) => (
                  <Fragment key={index}>
                    <TableRow
                      onClick={() => toggleExpansion(index)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      data-state={expandedIndex === index ? "expanded" : ""}
                    >
                      <TableCell className="pl-3 text-muted-foreground">
                        {expandedIndex === index ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={`${getMethodBadgeVariant(
                            log.log_data.method,
                          )} w-16 justify-center`}
                        >
                          {safeString(log.log_data.method)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          className={`${getStatusBadgeClass(
                            log.response?.status?.status,
                          )} w-14 justify-center`}
                        >
                          {log.response?.status?.status ?? "N/A"}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-foreground/80 truncate max-w-[240px]">
                        {safeString(log.log_data.url)}
                      </TableCell>

                      <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[220px]">
                        {safeString(log.log_data.userAgent)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.log_data.timestamp)}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {expandedIndex === index && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-4 py-3 border-t border-border/60">
                            <Tabs defaultValue="request">
                              <TabsList className="h-8">
                                <TabsTrigger
                                  value="request"
                                  className="text-xs h-7"
                                >
                                  Request
                                </TabsTrigger>
                                <TabsTrigger
                                  value="response"
                                  className="text-xs h-7"
                                >
                                  Response
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="request" className="mt-2">
                                <JsonViewer
                                  data={log.log_data}
                                  className="max-h-[320px]"
                                />
                              </TabsContent>
                              <TabsContent value="response" className="mt-2">
                                <JsonViewer
                                  data={log.response}
                                  className="max-h-[320px]"
                                />
                              </TabsContent>
                            </Tabs>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {hasMore && !isLoading && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isFetchingMore}
            className="min-w-[140px]"
          >
            {isFetchingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Loading…
              </>
            ) : (
              `Load more (${total - logs.length} remaining)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default LogViewer;
