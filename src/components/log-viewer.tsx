"use client";

import { useEffect, useState, FC } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@radix-ui/react-accordion";
import { useSession } from "next-auth/react";

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  payload: any;
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

  const userId = session?.user?.id;

  useEffect(() => {
    const fetchLogs = async () => {
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
    };

    fetchLogs();
    const intervalId = setInterval(fetchLogs, 60000); // Poll every 60 seconds

    return () => clearInterval(intervalId); // Cleanup interval
  }, [userId]);

  const handleClearLogs = () => {
    setLogs([]);
    toast.info("On-screen logs have been cleared.");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Request Logs</CardTitle>
          <CardDescription>
            Feed of incoming requests from third-party applications.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearLogs}
          disabled={logs.length === 0}
        >
          Clear On-Screen
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {logs.map((log, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <div key={index} className="border-b border-border/50 pb-2">
                    <AccordionTrigger className="w-full">
                      <div className="flex items-center gap-4 text-sm">
                        <Badge
                          className={`${getMethodBadgeVariant(
                            log.method
                          )} w-16 justify-center text-primary-foreground dark:text-foreground`}
                        >
                          {log.method}
                        </Badge>
                        <span className="font-mono text-muted-foreground flex-1 text-left">
                          {log.path}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-xs text-muted-foreground space-y-2 p-4 bg-muted/50 rounded-md">
                        <p>
                          <strong>IP Address:</strong> {log.ip}
                        </p>
                        <p>
                          <strong>User Agent:</strong> {log.userAgent}
                        </p>
                        {log.payload && (
                          <div>
                            <strong>Payload:</strong>
                            <pre className="mt-2 p-3 bg-background rounded-md text-foreground overflow-x-auto">
                              <code>
                                {JSON.stringify(log.payload, null, 2)}
                              </code>
                            </pre>
                          </div>
                        )}
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
