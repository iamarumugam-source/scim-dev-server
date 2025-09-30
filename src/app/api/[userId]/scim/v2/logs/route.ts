import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/scim/db";

const LOG_TABLE = "scim_logs";
interface RouteParams {
  params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const logPayload = await request.json();
    const requestData = logPayload["request"];
    requestData["timestamp"] = logPayload["timestamp"];
    const responseData = logPayload["responseData"];
    responseData["status"] = logPayload["responseStatus"] || {};

    const { error } = await supabase.from(LOG_TABLE).insert({
      log_data: requestData,
      tenantId: userId,
      response: responseData,
    });

    if (error) {
      throw new Error(`Supabase error saving log: ${error.message}`);
    }

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error: any) {
    console.error("Log saving API error:", error);
    return NextResponse.json(
      { detail: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const { data, error } = await supabase
      .from(LOG_TABLE)
      .select("log_data, response")
      .eq("tenantId", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Supabase error fetching logs: ${error.message}`);
    }

    // The log data is stored in the `log_data` column
    const logs = data.map((item) => {
      return { log_data: item.log_data, response: item.response };
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("Log fetching API error:", error);
    return NextResponse.json(
      { detail: "Internal Server Error" },
      { status: 500 }
    );
  }
}
