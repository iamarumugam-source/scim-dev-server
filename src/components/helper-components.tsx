import { AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const LoadingSpinner = () => (
  <div className="flex justify-center items-center p-8">
    <Spinner className="size-10 text-primary" />
  </div>
);

export const ErrorDisplay = ({ message }: { message: string }) => (
  <Alert variant="destructive" className="my-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{message}</AlertDescription>
  </Alert>
);
