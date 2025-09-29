import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { userId: string };
}
export async function POST(request: NextRequest, { params }: RouteParams) {
  const searchParams = request.nextUrl.searchParams;

  //   const hasGrnatType = searchParams.has("grant_type");
  //   const hasClientId = searchParams.has("client_id");
  //   const hasRedirectURI = searchParams.has("redirect_uri");
  const hasCode = searchParams.has("code");

  const OKTA_SIGNING_CLIENT = process.env.OKTA_SIGNING_CLIENT;
  const OKTA_SIGNING_SECRET = process.env.OKTA_SIGNING_SECRET;

  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${btoa(
      OKTA_SIGNING_CLIENT + ":" + OKTA_SIGNING_SECRET
    )}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (hasCode) {
    const codeVal = searchParams.get("code") as string;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri:
        "https://okta-inbound-scim.vercel.app/api/00u1x48tm4aH3UPmQ1d8/oauth2/authorize",
      code: codeVal,
    });

    const tokenCall = await fetch("https://arumugam.okta.com/oauth2/v1/token", {
      method: "POST",
      headers: headers,
      body: body.toString(),
    });

    if (!tokenCall.ok) {
      throw new Error(`HTTP error! Status: ${tokenCall.status}`);
    }
    const token = await tokenCall.json();
    return NextResponse.json(token, { status: 200 });
  }

  return NextResponse.json({}, { status: 200 });
}
