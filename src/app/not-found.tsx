import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileSearch className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-5xl font-bold tabular-nums tracking-tight">404</h1>
        <p className="text-lg font-medium text-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
