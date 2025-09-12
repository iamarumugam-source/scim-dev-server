import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Extends the built-in session.user type to include the properties
   * we are adding in the auth callbacks.
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"]
    accessToken?: string;
  }
}