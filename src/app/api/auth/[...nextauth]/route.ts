import NextAuth from "next-auth";
import OktaProvider from "next-auth/providers/okta";
import { AuthOptions } from "next-auth";

// Okta vars are injected at runtime (k8s ConfigMap + Secret in k8s deployments,
// .env.local on Vercel).  Removing the module-level throw lets Next.js build
// the bundle without any env vars present — the handler will fail gracefully at
// request time if the values are genuinely missing.
export const authOptions: AuthOptions = {
  providers: [
    OktaProvider({
      clientId:     process.env.OKTA_CLIENT_ID     ?? "",
      clientSecret: process.env.OKTA_CLIENT_SECRET ?? "",
      issuer:       process.env.OKTA_ISSUER        ?? "",
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
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
