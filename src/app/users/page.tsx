import { redirect } from "next/navigation";

export default function UsersRedirect() {
  redirect("/scim/users");
}
