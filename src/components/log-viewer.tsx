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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Input } from "./ui/input";
// import {
//   Dialog,
//   DialogClose,
//   DialogContent,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
import ComponentCode from "./Code";

interface LogEntry {
  log_data: any;
  response: any;
}

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubLight } from "@uiw/codemirror-theme-github";
import { useTheme } from "next-themes";

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
  const { theme, setTheme } = useTheme();
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
      <CardContent className="w-full">
        <div className="space-y-4">
          {logs.length > 0 ? (
            <Accordion type="single" collapsible className="">
              {logs.map((log, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <div
                    key={index}
                    className="w-full border-b border-border/50 pb-2"
                  >
                    <AccordionTrigger className="w-full cursor-pointer p-1 items-center">
                      <div className="flex items-center gap-4 text-sm justify-between">
                        <Badge
                          className={`${getMethodBadgeVariant(
                            log.log_data.method
                          )} w-16 justify-center text-primary-foreground dark:text-foreground`}
                        >
                          {log.log_data.method}
                        </Badge>
                        <Separator
                          orientation="vertical"
                          className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        <div className="text-xs font-mono text-muted-foreground text-left">
                          {log.log_data.url}
                        </div>
                        <Separator
                          orientation="vertical"
                          className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        <div className="text-xs font-mono text-muted-foreground text-left w-70">
                          {log.log_data.userAgent}
                        </div>
                        <Separator
                          orientation="vertical"
                          className="mx-2 data-[orientation=vertical]:h-4"
                        />
                        <div className="text-xs font-mono text-muted-foreground hidden sm:inline">
                          {new Date(
                            log.log_data.timestamp
                          ).toLocaleTimeString()}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="w-full">
                      {/* <div className="flex w-full max-w-sm flex-col gap-6"> */}
                      <Tabs defaultValue="request">
                        <TabsList>
                          <TabsTrigger value="request">Request</TabsTrigger>
                          <TabsTrigger value="response">Response</TabsTrigger>
                        </TabsList>
                        <TabsContent value="request" className="w-full">
                          <div className="text-xs text-muted-foreground space-y-2 p-4 rounded-md mt-2 border w-full">
                            {log.log_data && (
                              <div className="text-xs rounded-md relative truncate w-full">
                                <CodeMirror
                                  value={JSON.stringify(log.log_data, null, 2)}
                                  height="400px"
                                  theme={
                                    theme == "dark" ? dracula : githubLight
                                  }
                                  extensions={[javascript({ jsx: true })]}
                                />
                              </div>
                            )}
                          </div>
                        </TabsContent>
                        <TabsContent value="response">
                          <div className="text-xs text-muted-foreground space-y-2 p-4 rounded-md mt-2 border w-full">
                            {log.response && (
                              <div className="text-xs rounded-md relative truncate w-full">
                                <CodeMirror
                                  value={JSON.stringify(log.response, null, 2)}
                                  height="400px"
                                  theme={
                                    theme == "dark" ? dracula : githubLight
                                  }
                                  extensions={[javascript({ jsx: true })]}
                                />
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                      {/* </div> */}
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

// const PlayLastResponse = ({ url }: { url: string }) => {
//   const [code, setCode] = useState<any | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const fetchData = useCallback(async () => {
//     setIsLoading(true);
//     setError(null);
//     try {
//       const res = await fetch(url);
//       if (!res.ok) {
//         throw new Error(`Request failed with status ${res.status}`);
//       }
//       const data = await res.json();
//       setCode(data);
//     } catch (e: any) {
//       setError(e.message);
//       toast.error(`Replay failed: ${e.message}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [url]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   if (isLoading) {
//     return <div>Loading replay...</div>;
//   }

//   if (error) {
//     return <div className="text-red-500">Error: {error}</div>;
//   }

//   return (
//     <div className="text-xs rounded-md overflow-hidden whitespace-pre max-h-80 max-w-80">
//       <ComponentCode code={JSON.stringify(code, null, 2)} />
//     </div>
//   );
// };

export default LogViewer;
