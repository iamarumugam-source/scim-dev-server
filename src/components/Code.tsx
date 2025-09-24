import { useEffect, useState } from "react";
import { highlightCode } from "./lib/highlight-code";
import { CopyButton } from "./copy-button";

export default function ComponentCode({ code }: { code: string }) {
  const [highlightedRequest, setHighlightedRequest] = useState("");

  useEffect(() => {
    const generateHighlight = async () => {
      if (code) {
        const highlighted = await highlightCode(code, "json");
        setHighlightedRequest(highlighted);
      }
    };

    generateHighlight();
  }, []);
  return (
    <div data-rehype-pretty-code-title="" className="relative overflow-hidden">
      <CopyButton value={code} />
      <div
        dangerouslySetInnerHTML={{ __html: highlightedRequest }}
        className="overflow-x-auto text-xs"
      />
    </div>
  );
}
