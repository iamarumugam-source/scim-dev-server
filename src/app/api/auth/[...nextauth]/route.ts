import NextAuth from "next-auth"
import OktaProvider from "next-auth/providers/okta";
import { AuthOptions } from "next-auth";

// Ensure environment variables are set, otherwise throw an error during build
if (!process.env.OKTA_CLIENT_ID || !process.env.OKTA_CLIENT_SECRET || !process.env.OKTA_ISSUER) {
    throw new Error('Okta environment variables are not set. Please check your .env.local file.');
}

// Export authOptions so it can be used by getServerSession in your API routes
export const authOptions: AuthOptions = {
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };