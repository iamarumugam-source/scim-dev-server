import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  console.log(request.nextUrl);

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
    redirect(redirect_url);
  }

  return NextResponse.json({}, { status: 200 });
}
