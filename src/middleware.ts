export { default } from "next-auth/middleware"

export const config = {
  /**
   * This matcher specifies which routes the middleware should apply to.
   * We are protecting the root route ('/'), which is where your
   * dashboard page is located. Any unauthenticated attempt to access this
   * page will result in a redirect to the Okta login page.
   */
  matcher: ["/"],
}
