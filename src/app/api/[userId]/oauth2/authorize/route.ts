import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const hasResponseType = searchParams.has("response_type");
  const hasClientId = searchParams.has("client_id");
  const hasRedirectURI = searchParams.has("redirect_uri");
  const hasCode = searchParams.has("code");
  const hasState = searchParams.has("state");

  const OKTA_SIGNING_CLIENT = process.env.OKTA_SIGNING_CLIENT;
  const AUTH_URI = `https://okta-inbound-scim.vercel.app/api/00u1x48tm4aH3UPmQ1d8/oauth2/authorize`;

  if (hasResponseType && hasClientId && hasRedirectURI) {
    const redirectURI = searchParams.get("redirect_uri");
    const redURL = `https://arumugam.okta.com/oauth2/v1/authorize?client_id=${OKTA_SIGNING_CLIENT}&response_type=code&scope=openid&redirect_uri=${AUTH_URI}&state=${redirectURI}`;
    redirect(redURL);
  }

  if (hasCode && hasState) {
    const codeValue = searchParams.get("code");
    const redirectURI = searchParams.get("state");
    const redirect_url = `${redirectURI}?code=${codeValue}`;
    console.log("Inside Redirect Block");
    return NextResponse.redirect(new URL(redirect_url), { status: 302 });
  }

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
