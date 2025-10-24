"use client";

import { useEffect, useState, FC, useCallback, Fragment } from "react";

import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RefreshCw, Trash } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LogEntry {
  log_data: any;
  response: any;
}

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const getMethodBadgeVariant = (method: string) => {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500 hover:bg-blue-500 font-semibold text-primary-foreground dark:text-sidebar-accent-foreground";
    case "POST":
      return "bg-green-600 hover:bg-green-600 font-semibold text-primary-foreground dark:text-sidebar-accent-foreground";
    case "PUT":
    case "PATCH":
      return "bg-yellow-500 hover:bg-yellow-500 text-black font-semibold text-primary-foreground dark:text-sidebar-accent-foreground";
    case "DELETE":
      return "bg-red-600 hover:bg-red-600 font-semibold text-primary-foreground dark:text-sidebar-accent-foreground";
    default:
      return "bg-gray-500 hover:bg-gray-500 font-semibold text-primary-foreground dark:text-sidebar-accent-foreground";
  }
};

const getStatusBadgeClass = (status: number) => {
  if (status >= 500)
    return "bg-red-600 text-primary-foreground dark:text-sidebar-accent-foreground";
  if (status >= 400) return "bg-yellow-500 text-black";
  if (status >= 300)
    return "bg-blue-500 text-primary-foreground dark:text-sidebar-accent-foreground";
  if (status >= 200)
    return "bg-green-600 text-primary-foreground dark:text-sidebar-accent-foreground";
  return "bg-gray-500";
};

const LogViewer: FC = () => {
  const { theme, setTheme } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { data: session } = useSession();
  const [isLive, setIsLive] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const userId = session?.user?.id;

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/${userId}/scim/v2/logs`);
      if (!res.ok) {
        console.error("Failed to fetch logs");
        return;
      }
      const newLogs: LogEntry[] = await res.json();
      setLogs(newLogs);
    } catch (e) {
      console.error("Error polling for logs:", e);
    }
  }, [userId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (isLive) {
      fetchLogs();
      const intervalId = setInterval(fetchLogs, 30000);

      return () => clearInterval(intervalId);
    }
  }, [isLive, fetchLogs]);

  const handleToggleChange = (pressed: boolean) => {
    setIsLive(pressed);
    if (pressed) {
      toast.info("Live log polling has been activated.");
    } else {
      toast.info("Live log polling has been deactivated.");
    }
  };

  const toggleExpansion = (index: number) => {
    setExpandedIndex((prevIndex) => (prevIndex === index ? null : index));
  };
  return (
    <div className="container mx-auto py-10">
      <div className="flex space-x-1 items-center">
        <div className="ml-auto mb-2">
          <Toggle
            aria-label="Toggle live logs"
            variant="outline"
            className="cursor-pointer mr-2"
            pressed={isLive}
            onPressedChange={handleToggleChange}
          >
            <RefreshCw className={`h-4 w-4 ${isLive ? "animate-spin" : ""}`} />
          </Toggle>
          <Button variant="outline">
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[100px]">Method</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="hidden md:table-cell">User Agent</TableHead>
              <TableHead className="w-[120px] text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <Fragment key={index}>
                  <TableRow
                    onClick={() => toggleExpansion(index)}
                    className="cursor-pointer"
                  >
                    <TableCell className="pl-4">
                      {expandedIndex === index ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${getMethodBadgeVariant(
                          log.log_data.method
                        )} w-16 justify-center text-primary-foreground`}
                      >
                        {/* ✅ Safely render the method */}
                        {typeof log.log_data.method === "object"
                          ? JSON.stringify(log.log_data.method)
                          : log.log_data.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${getStatusBadgeClass(
                          log.response?.status.status
                        )} w-16 justify-center text-primary-foreground`}
                      >
                        {log.response?.status.status ?? "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[200px]">
                      {typeof log.log_data.url === "object"
                        ? JSON.stringify(log.log_data.url)
                        : log.log_data.url}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                      {typeof log.log_data.userAgent === "object"
                        ? JSON.stringify(log.log_data.userAgent)
                        : log.log_data.userAgent}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {new Date(log.log_data.timestamp).toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                  {expandedIndex === index && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4 bg-muted/50">
                          <Tabs defaultValue="request">
                            <TabsList>
                              <TabsTrigger value="request">Request</TabsTrigger>
                              <TabsTrigger value="response">
                                Response
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="request" className="mt-2">
                              <CodeMirror
                                value={JSON.stringify(log.log_data, null, 2)}
                                height="300px"
                                theme={theme === "dark" ? dracula : githubLight}
                                extensions={[javascript({ jsx: true })]}
                                readOnly
                              />
                            </TabsContent>
                            <TabsContent value="response" className="mt-2">
                              <CodeMirror
                                value={JSON.stringify(log.response, null, 2)}
                                height="300px"
                                theme={theme === "dark" ? dracula : githubLight}
                                extensions={[javascript({ jsx: true })]}
                                readOnly
                              />
                            </TabsContent>
                          </Tabs>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Waiting for incoming API requests...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LogViewer;
