import { NextRequest, NextResponse } from "next/server";
import { LogService } from "@/lib/scim/services/logService";

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

    const logService = new LogService();
    await logService.insertLog(userId, requestData, responseData);

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error: any) {
    console.error("Log saving API error:", error);
    return NextResponse.json(
      { detail: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;

    const logService = new LogService();
    await logService.deleteLogs(userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Log clearing API error:", error);
    return NextResponse.json(
      { detail: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const limit  = Math.min(parseInt(searchParams.get("limit")  || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const logService = new LogService();
    const { logs, total } = await logService.getLogs(userId, limit, offset);

    return NextResponse.json({
      logs,
      total,
      hasMore: offset + logs.length < total,
    });
  } catch (error: any) {
    console.error("Log fetching API error:", error);
    return NextResponse.json(
      { detail: "Internal Server Error" },
      { status: 500 }
    );
  }
}
