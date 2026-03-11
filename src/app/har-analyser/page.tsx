import HarAnalyser from "@/components/har-analyser";

export default function HarAnalyserPage() {
  return (
    <div className="flex flex-col h-full px-4 pt-8 pb-4 gap-4">
      <h1 className="text-2xl font-bold">HAR Analyser</h1>
      <HarAnalyser />
    </div>
  );
}
