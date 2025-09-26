import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    return NextResponse.next();
  },
  {
    // You can add callbacks here for more granular control if needed.
  }
);

export const config = {
  matcher: ["/((?!api|jwe|_next/static|_next/image|favicon.ico).*)"],
};
