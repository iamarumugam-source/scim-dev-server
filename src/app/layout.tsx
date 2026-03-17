import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
// import "./codehighlight.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/components/AuthProvider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/app-header";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "SCIM Admin Dashboard",
  description: "Manage SCIM users and groups",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore   = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state")?.value;
  const sidebarOpen   = sidebarCookie !== "false";

  return (
    <html lang="en" suppressHydrationWarning className="layout-full">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          "font-sans antialiased overscroll-none group/body [--footer-height:calc(var(--spacing)*14)] [--header-height:calc(var(--spacing)*14)] xl:[--footer-height:calc(var(--spacing)*24)]",
        )}
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider
              defaultOpen={sidebarOpen}
              style={
                {
                  "--sidebar-width": "calc(var(--spacing) * 72)",
                  "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
              }
            >
              <AppSidebar />
              <SidebarInset>
                <SiteHeader />
                {/**
                 * The following container class fixes issues with resizing. Picked from Shadcn Blocks
                 */}
                <div className="@container/main flex flex-1 flex-col">
                  {children}
                </div>
                <Toaster richColors position="bottom-right" />
              </SidebarInset>
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
