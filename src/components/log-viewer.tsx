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
import { RefreshCw, Trash, Repeat } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@radix-ui/react-accordion";
import { useSession } from "next-auth/react";
import { Separator } from "@/components/ui/separator";
import { Button } from "./ui/button";
import { getIconForLanguageExtension } from "./icons";
import { CopyButton } from "./copy-button";
import { highlightCode } from "./lib/highlight-code";
import { IconJson } from "@tabler/icons-react";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
            <Accordion type="single" collapsible className="">
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
                    <AccordionContent className="w-3xl">
                      <div className="text-xs text-muted-foreground space-y-2 p-4 bg-muted/50 rounded-md mt-2">
                        {/* <p>
                          <strong>IP Address:</strong> {log.request.ip}
                        </p> */}
                        <div className="flex items-center justify-between">
                          <div className="font-bold w-1/4">
                            Replay this request:
                          </div>
                          <Input
                            disabled
                            placeholder={log.request.url}
                            className="w-234"
                          />
                          <Dialog
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline">
                                <Repeat />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Here is the replay of the last request
                                </DialogTitle>
                              </DialogHeader>

                              <PlayLastResponse url={log.request.url} />

                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Close</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>

                        {log.request.body && (
                          <div className="text-xs rounded-md overflow-x-auto whitespace-pre">
                            <strong>Payload:</strong>
                            <ComponentCode
                              code={JSON.stringify(log.request.body, null, 2)}
                              language="json"
                              title="Request"
                            />
                          </div>
                        )}

                        {log.request && (
                          <div className="text-xs rounded-md overflow-x-auto whitespace-pre">
                            <strong>Request:</strong>
                            <ComponentCode
                              code={JSON.stringify(log.request, null, 2)}
                              language="json"
                              title="Request"
                            />
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

const PlayLastResponse = ({ url }: { url: string }) => {
  const [code, setCode] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setCode(data);
    } catch (e: any) {
      setError(e.message);
      toast.error(`Replay failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <div>Loading replay...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="text-xs rounded-md overflow-x-auto whitespace-pre max-h-80">
      <ComponentCode
        code={JSON.stringify(code || {}, null, 2)}
        language="json"
        title="Request"
      />
    </div>
  );
};

function ComponentCode({
  code,
  title,
}: {
  code: string;
  language: string;
  title: string | undefined;
}) {
  const [highlightedRequest, setHighlightedRequest] = useState("");

  useEffect(() => {
    const generateHighlight = async () => {
      if (code) {
        const highlighted = await highlightCode(code, "json");
        setHighlightedRequest(highlighted);
      }
    };

    generateHighlight();
  }, []);
  return (
    <div data-rehype-pretty-code-title="" className="relative overflow-hidden">
      <CopyButton value={code} />
      <div dangerouslySetInnerHTML={{ __html: highlightedRequest }} />
    </div>
  );
}

export default LogViewer;
