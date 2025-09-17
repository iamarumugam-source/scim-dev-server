import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";

export async function getUserId() {
  const session = await getServerSession(authOptions);
    if (session && session.user) {
        return session.user.id;
    }
}