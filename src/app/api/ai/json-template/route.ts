import { NextRequest, NextResponse } from "next/server";

const LLM_BASE_URL = process.env.LLM_BASE_URL;
const LLM_API_KEY  = process.env.LLM_API_KEY;
const LLM_MODEL    = process.env.LLM_MODEL ?? "gpt-3.5-turbo";

const SYSTEM_PROMPT = `You are a SCIM schema extension template converter.
Given a sample JSON object, convert it into a reusable template by replacing runtime values with {{...}} expression placeholders while keeping the exact structure intact.

Available expressions:

USER PROPERTIES — use {{user.<path>}} when the value represents a property of the user being provisioned:
  {{user.id}}                 unique user ID (UUID)
  {{user.userName}}           login username / email
  {{user.displayName}}        display name
  {{user.name.formatted}}     full formatted name
  {{user.name.givenName}}     first name
  {{user.name.familyName}}    last name
  {{user.title}}              job title
  {{user.userType}}           user type (Employee, Contractor…)
  {{user.locale}}             locale (en-US, en-GB…)
  {{user.timezone}}           timezone string
  {{user.preferredLanguage}}  preferred language
  {{user.emails.0.value}}     primary email address
  {{user.active}}             active status (boolean)

FAKER GENERATORS — use {{faker.<path>}} for values that should be generated randomly per request:
  {{faker.string.uuid}}          random UUID / unique ID
  {{faker.string.numeric}}       random numeric string (employee numbers, staff IDs)
  {{faker.person.jobTitle}}      random job title
  {{faker.person.fullName}}      random full name
  {{faker.company.name}}         random company / organisation name
  {{faker.commerce.department}}  random department name
  {{faker.location.city}}        random city
  {{faker.location.country}}     random country name
  {{faker.date.past}}            a past date string
  {{faker.finance.amount}}       a monetary amount

ALWAYS REPLACE these categories of values — be aggressive:
- Any UUID or short ID string (e.g. "9xp6g7yq", "abc-123") → {{faker.string.uuid}}
- Contract IDs, employment IDs, record IDs → {{faker.string.uuid}}
- Employee numbers, staff IDs, payroll numbers → {{faker.string.numeric}}
- Department names that look like real departments → {{faker.commerce.department}}
- Person names (full, first, last, display) → appropriate {{user.name.*}} expression
- Email addresses → {{user.emails.0.value}}
- Job titles / roles → {{user.title}}
- Manager or supervisor name / email / ID → {{user.name.formatted}} / {{user.emails.0.value}} / {{user.id}}
- Organisation / company names → {{faker.company.name}}
- Cost centres, numeric codes → {{faker.string.numeric}}
- Start dates, hire dates, birth dates → {{faker.date.past}}
- End / future dates → {{faker.date.future}}
- Amounts / salaries / costs → {{faker.finance.amount}}

KEEP STATIC — do NOT replace these:
- Fixed type / category labels: "hris_direct_employee", "Team", "Department", "SGD", "work", "home"
- Boolean values: true, false
- null values
- ISO country / currency codes: "SG", "USD"
- Percentage strings: "100%", "0.5 to 3 Months"
- Schema URNs
- Structural field names (only replace VALUES, never object keys)

Rules:
1. Preserve the EXACT JSON structure — every key, nesting level, array, and type must stay identical.
2. Return ONLY valid JSON with the expressions embedded — no markdown, no code fences, no explanation.
3. If the user asks for a follow-up change, apply it to the previously converted template and return the full updated JSON.
4. When in doubt, replace rather than keep — the user can always ask to revert a specific field.`;

export async function POST(req: NextRequest) {
  if (!LLM_BASE_URL || !LLM_API_KEY) {
    return NextResponse.json(
      { error: "LLM not configured. Set LLM_BASE_URL and LLM_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  const { messages } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "messages array is required." }, { status: 400 });
  }

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
        max_tokens: 2000,
        messages:   [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not reach LLM: ${e.message}` },
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
            const content = JSON.parse(data).choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new NextResponse(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
