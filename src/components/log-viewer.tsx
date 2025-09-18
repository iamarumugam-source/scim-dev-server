"use client";

import { useEffect, useState, FC, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Trash, Play } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@radix-ui/react-accordion";
import { useSession } from "next-auth/react";
import { Separator } from "@/components/ui/separator";
import { Button } from "./ui/button";

interface LogEntry {
  timestamp: string;
  path: string;
  request: any;
}

const getMethodBadgeVariant = (method: string) => {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500 hover:bg-blue-500 font-semibold";
    case "POST":
      return "bg-green-600 hover:bg-green-600 font-semibold";
    case "PUT":
    case "PATCH":
      return "bg-yellow-500 hover:bg-yellow-500 text-black font-semibold";
    case "DELETE":
      return "bg-red-600 hover:bg-red-600 font-semibold";
    default:
      return "bg-gray-500 hover:bg-gray-500 font-semibold";
  }
};

const LogViewer: FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { data: session } = useSession();
  const [isLive, setIsLive] = useState(false);

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

  // Fetch during initial page load
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
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col items-center justify-between">
        <CardTitle className="flex items-center justify-between w-full">
          Request Logs
          <div className="flex space-x-1">
            <Toggle
              aria-label="Toggle live logs"
              variant="outline"
              className="cursor-pointer"
              // onClick={toggle}
              pressed={isLive}
              onPressedChange={handleToggleChange}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLive ? "animate-spin" : ""}`}
              />
            </Toggle>
            <Button variant="outline">
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="w-full">
          Feed of incoming requests from third-party applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {logs.map((log, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <div key={index} className="border-b border-border/50 pb-2">
                    <AccordionTrigger className="w-full cursor-pointer p-1 items-center">
                      <div className="flex items-center gap-4 text-sm">
                        <Badge
                          className={`${getMethodBadgeVariant(
                            log.request.method
                          )} w-16 justify-center text-primary-foreground dark:text-foreground`}
                        >
                          {log.request.method}
                        </Badge>
                        <Separator
                          orientation="vertical"
                          className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        <span className="text-xs font-mono text-muted-foreground flex-1 text-left">
                          {log.path}
                        </span>
                        <Separator
                          orientation="vertical"
                          className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        <span className="font-mono text-muted-foreground flex-1 text-left">
                          {log.request.userAgent}
                        </span>
                        <Separator
                          orientation="vertical"
                          className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-xs text-muted-foreground space-y-2 p-4 bg-muted/50 rounded-md mt-2">
                        <p>
                          <strong>IP Address:</strong> {log.request.ip}
                        </p>
                        <p>
                          <strong>User Agent:</strong> {log.request.userAgent}
                        </p>
                        {log.request.body && (
                          <div>
                            <strong>Payload:</strong>
                            <pre className="mt-2 p-3 bg-background rounded-md text-foreground overflow-x-auto">
                              <code>
                                {JSON.stringify(log.request.body, null, 2)}
                              </code>
                            </pre>
                          </div>
                        )}

                        {log.request && (
                          <div>
                            <strong>Request:</strong>
                            <pre className="mt-2 p-3 bg-background rounded-md text-foreground overflow-x-auto">
                              <code>
                                {JSON.stringify(log.request, null, 2)}
                              </code>
                            </pre>
                          </div>
                        )}
                        {/* {log.response && (
                          <div>
                            <strong>Response:</strong>
                            <pre className="mt-2 p-3 bg-background rounded-md text-foreground overflow-x-auto">
                              <code>
                                {JSON.stringify(log.response, null, 2)}
                              </code>
                            </pre>
                          </div>
                        )} */}
                      </div>
                    </AccordionContent>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Waiting for external API requests...
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LogViewer;
