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
      authorization: {
        params: {
          scope: "openid profile email" // Ensure these scopes are requested
        }
      }
    }),
  ],
  session: {
    strategy: "jwt", // Using JWTs is required for this callback approach
  },
  callbacks: {
    /**
     * This callback is called whenever a JWT is created or updated.
     * It runs on sign-in and when the session is accessed.
     */
    async jwt({ token, user, account }) {
      // This block only runs on the initial sign-in
      // console.log(token)
      if (account && user) {
        // Persist the OIDC access_token and user's ID (sub) to the token
        token.accessToken = account.access_token;
        token.id = user.id; // user.id from Okta is the 'sub' claim
      }
      return token;
    },

    /**
     * This callback is called whenever a session is checked.
     * It runs on every `useSession()` or `getServerSession()` call.
     */
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user ID from the token.
      // The `token` object here is what was returned from the `jwt` callback.
      session.accessToken = token.accessToken as string | undefined;
      
      if (session.user) {
        session.user.id = token.id as string;
      }
      
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

