import { NextRequest, NextResponse } from "next/server";

const LLM_BASE_URL = process.env.LLM_BASE_URL;
const LLM_API_KEY  = process.env.LLM_API_KEY;
const LLM_MODEL    = process.env.LLM_MODEL ?? "gpt-3.5-turbo";

const SYSTEM_PROMPT = `You are an expert Okta developer assistant specialising in OIDC/OAuth 2.0, SCIM, and the Okta platform.
Your job is to analyse failing API requests and provide specific, actionable troubleshooting guidance.

When providing suggestions:
- Always reference the relevant Okta documentation URLs from developer.okta.com
- Identify the most likely root cause first
- Give concrete, numbered steps to resolve the issue
- Include example values or code snippets where helpful
- If the error is an OAuth 2.0 error code (e.g. invalid_client, access_denied), explain exactly what it means in Okta's context
- Keep the response focused and practical — no padding`;

function kv(obj: Record<string, string>, indent = "  "): string[] {
  return Object.entries(obj).map(([k, v]) => `${indent}${k}: ${v}`);
}

function buildPrompt(body: Record<string, unknown>): string {
  const {
    url, method, status, statusText, oidcPhase,
    requestHeaders, urlParams, bodyParams, responseJson,
  } = body;

  const lines: string[] = [
    `Analyse this failing ${oidcPhase ? `OIDC ${oidcPhase}` : "API"} request and suggest specific fixes:`,
    "",
    `  Endpoint: ${method} ${url}`,
    `  Status:   ${status} ${statusText}`,
  ];

  if (oidcPhase) lines.push(`  OIDC Phase: ${oidcPhase}`);

  if (urlParams && Object.keys(urlParams as object).length > 0) {
    lines.push("", "URL query parameters sent:");
    lines.push(...kv(urlParams as Record<string, string>));
  }

  if (bodyParams && Object.keys(bodyParams as object).length > 0) {
    lines.push("", "Request body parameters sent:");
    lines.push(...kv(bodyParams as Record<string, string>));
  }

  if (requestHeaders && Object.keys(requestHeaders as object).length > 0) {
    lines.push("", "Key request headers:");
    lines.push(...kv(requestHeaders as Record<string, string>));
  }

  if (responseJson && typeof responseJson === "object") {
    const r = responseJson as Record<string, unknown>;
    lines.push("", "Response error details:");
    for (const field of ["error", "error_description", "errorCode", "errorSummary", "errorLink", "errorId"]) {
      if (r[field]) lines.push(`  ${field}: ${r[field]}`);
    }
    if (Array.isArray(r.errorCauses) && r.errorCauses.length > 0) {
      lines.push("  errorCauses:");
      (r.errorCauses as unknown[]).slice(0, 3).forEach((c) => {
        lines.push(`    - ${JSON.stringify(c)}`);
      });
    }
    const knownFields = new Set(["error", "error_description", "errorCode", "errorSummary", "errorLink", "errorId", "errorCauses"]);
    const extra = Object.entries(r).filter(([k]) => !knownFields.has(k)).slice(0, 5);
    if (extra.length > 0) {
      for (const [k, v] of extra) lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }
  }

  lines.push(
    "",
    "Using the exact parameter values above, explain why this specific request failed and how to fix it.",
    "Respond in this format:",
    "",
    "## Root Cause",
    "(one-paragraph explanation referencing the exact parameter values)",
    "",
    "## Steps to Fix",
    "(numbered list with specific values to change or verify)",
    "",
    "## Relevant Okta Documentation",
    "(bulleted list of URLs from developer.okta.com)",
  );

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  if (!LLM_BASE_URL || !LLM_API_KEY) {
    return NextResponse.json(
      { error: "LLM not configured. Add LLM_BASE_URL and LLM_API_KEY to .env.local then restart." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userPrompt = buildPrompt(body);

  let upstream: Response;
  try {
    upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model:      LLM_MODEL,
        stream:     true,
        max_tokens: 2500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userPrompt },
        ],
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not reach LLM at ${LLM_BASE_URL}. Is the LiteLLM proxy running? (${e.message})` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `LLM returned ${upstream.status}: ${text.slice(0, 300)}` },
      { status: upstream.status },
    );
  }

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      const reader  = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { controller.close(); return; }
          try {
            const chunk   = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {}
        }
      }

      // Flush any remaining buffered line after the stream ends
      if (buffer.startsWith("data: ")) {
        const data = buffer.slice(6).trim();
        if (data && data !== "[DONE]") {
          try {
            const chunk   = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
