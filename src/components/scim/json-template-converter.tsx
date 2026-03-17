"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Copy, Check, RotateCcw, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LiveWaveform } from "@/components/har/live-waveform";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Copy"
      className="absolute right-2 top-2 h-6 w-6 text-muted-foreground"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

// ─── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all">
          {msg.content}
        </div>
      </div>
    );
  }

  const trimmed = msg.content.trim();
  let isJson = false;
  try {
    JSON.parse(trimmed);
    isJson = true;
  } catch {}

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full">
        <div className="relative rounded-lg border border-border bg-muted/30">
          {isJson && <CopyCode text={trimmed} />}
          <pre
            className={cn(
              "text-xs font-mono whitespace-pre-wrap break-all p-3 leading-relaxed",
              isJson && "pr-8",
              msg.streaming &&
                "after:content-['▋'] after:animate-pulse after:ml-0.5",
            )}
          >
            {msg.content || (msg.streaming ? "" : "—")}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Converter sheet ──────────────────────────────────────────────────────────

export function JsonTemplateConverter() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/config")
      .then((r) => r.json())
      .then((d) => setModelName(d.model ?? null))
      .catch(() => {});
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: text.trim() },
      ];
      setMessages([
        ...newMessages,
        { role: "assistant", content: "", streaming: true },
      ]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/ai/json-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || "Conversion failed");
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let content = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content, streaming: true },
          ]);
        }

        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content },
        ]);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        toast.error(e.message);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading],
  );

  const handleSubmit = () => send(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
  };

  const isEmpty = messages.length === 0;
  const isStreaming =
    isLoading && messages.at(-1)?.streaming && !messages.at(-1)?.content;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          AI Template Builder
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-lg p-0 gap-0"
      >
        {/* ── Header ── */}
        <SheetHeader className="flex-shrink-0 px-4 py-3 bg-amber-50/60 dark:bg-amber-950/20 border-b border-border">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <SheetTitle className="text-sm font-semibold">
                AI Template Builder
              </SheetTitle>
            </div>
            {!isEmpty && (
              <Button
                size="sm"
                variant="outline"
                onClick={reset}
                className="gap-1.5 h-7 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste a sample JSON and I'll convert it to a template with{" "}
            <code className="font-mono text-primary">{"{{user.*}}"}</code> /{" "}
            <code className="font-mono text-primary">{"{{faker.*}}"}</code>{" "}
            expressions. Ask follow-up messages to refine.
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Only available when running locally. Requires{" "}
            <code className="font-mono">LLM_BASE_URL</code>,{" "}
            <code className="font-mono">LLM_API_KEY</code>, and{" "}
            <code className="font-mono">LLM_MODEL</code>.
          </p>
        </SheetHeader>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Paste a sample JSON below
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  I'll convert string values to dynamic expressions. You can
                  then ask me to adjust specific fields.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-left text-xs font-mono text-muted-foreground max-w-xs space-y-0.5">
                <p>{"{"}</p>
                <p>&nbsp;&nbsp;"contractId": "9xp6g7yq",</p>
                <p>&nbsp;&nbsp;"title": "CISO",</p>
                <p>&nbsp;&nbsp;"country": "SG"</p>
                <p>{"}"}</p>
                <p className="text-primary mt-1">→ converts to →</p>
                <p>{"{"}</p>
                <p>&nbsp;&nbsp;"contractId": {"{{faker.string.uuid}}"},</p>
                <p>&nbsp;&nbsp;"title": {"{{user.title}}"},</p>
                <p>&nbsp;&nbsp;"country": "SG"</p>
                <p>{"}"}</p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              // Show waveform in place of the empty streaming assistant bubble
              if (msg.role === "assistant" && msg.streaming && !msg.content) {
                return (
                  <div key={i} className="px-2 py-4">
                    <LiveWaveform
                      processing
                      height={32}
                      barWidth={3}
                      barGap={2}
                      barRadius={2}
                      barColor="#f59e0b"
                      fadeEdges
                      fadeWidth={24}
                      mode="static"
                      className="w-full max-w-[200px]"
                    />
                  </div>
                );
              }
              return <MessageBubble key={i} msg={msg} />;
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 p-3">
          <InputGroup>
            <InputGroupTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isEmpty
                  ? `Paste your JSON or describe a template…\n\n{ "contractId": "abc-123",\n  "title": "CISO",\n  "country": "SG" }`
                  : `Ask a follow-up…\n\ne.g. "keep country as static" or\n     "use faker for contractId"`
              }
              className="min-h-[130px] max-h-[220px] px-4 pt-4 pb-3 text-sm leading-relaxed placeholder:text-muted-foreground/50"
              style={{ height: "130px" }}
              disabled={isLoading}
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton
                variant="outline"
                size="icon-xs"
                className="rounded-full"
                aria-label="Clear conversation"
                onClick={reset}
                disabled={isEmpty || isLoading}
              >
                <Sparkles className="size-3 text-[#4285F4]" />
              </InputGroupButton>
              <InputGroupText className="mr-auto truncate max-w-[40%]">
                {modelName ?? "AI"}
              </InputGroupText>

              <Separator orientation="vertical" className="h-4" />
              <InputGroupButton
                variant="default"
                size="icon-xs"
                className="rounded-full"
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
              >
                <ArrowUp className="h-3 w-3" />
                <span className="sr-only">Send</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
