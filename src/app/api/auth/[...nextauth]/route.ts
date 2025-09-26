import NextAuth from "next-auth";
import OktaProvider from "next-auth/providers/okta";
import { AuthOptions } from "next-auth";

if (
  !process.env.OKTA_CLIENT_ID ||
  !process.env.OKTA_CLIENT_SECRET ||
  !process.env.OKTA_ISSUER
) {
  throw new Error(
    "Okta environment variables are not set. Please check your .env.local file."
  );
}

export const authOptions: AuthOptions = {
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
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
