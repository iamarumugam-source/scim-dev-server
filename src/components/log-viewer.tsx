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
import { toast } from "sonner";

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
}

const LogViewer: FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/scim/v2/logs");
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

    fetchLogs(); // Fetch immediately on component mount
    const intervalId = setInterval(fetchLogs, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId); // Cleanup interval
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
    toast.info("On-screen logs have been cleared.");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>External API Requests</CardTitle>
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
        <div className="bg-muted/50 rounded-lg p-4 h-[480px] overflow-y-auto font-mono text-sm space-y-3">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="border-b border-border/50 pb-2">
                <div className="flex justify-between items-center">
                  <p>
                    <span
                      className={
                        log.method === "GET"
                          ? "text-blue-400"
                          : log.method === "POST"
                          ? "text-green-400"
                          : log.method === "PUT"
                          ? "text-yellow-400"
                          : log.method === "DELETE"
                          ? "text-red-400"
                          : ""
                      }
                    >
                      <strong>{log.method}</strong>
                    </span>
                    <span className="text-foreground/80"> {log.path}</span>
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  IP: {log.ip} | User-Agent: {log.userAgent}
                </p>
              </div>
            ))
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
