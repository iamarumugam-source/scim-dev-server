import LogViewer from "@/components/log-viewer";

export default function LogsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Logs</h1>
      <LogViewer />
    </div>
  );
}
