"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

const ComponentCode = ({ code, title }: { code: string; title?: string }) => (
  <div>
    {title && <h3 className="text-sm font-semibold mb-2">{title}</h3>}
    <pre className="p-3 bg-muted rounded-md text-muted-foreground overflow-x-auto whitespace-pre text-xs">
      <code>{code}</code>
    </pre>
  </div>
);

function b64UrlDecode(str: string) {
  let output = str.replace(/-/g, "+").replace(/_/g, "/");
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += "==";
      break;
    case 3:
      output += "=";
      break;
    default:
      throw new Error("Illegal base64url string!");
  }
  return atob(output);
}

export default function JWE() {
  const [jwkString, setJwkString] = useState("");
  const [jweString, setJweString] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [rawJWK, setRawJWK] = useState("");

  const [header, setHeader] = useState<object | null>(null);
  const [payload, setPayload] = useState<object | null>(null);

  const handleClick = async () => {
    setIsDecrypting(true);
    setHeader(null);
    setPayload(null);
    try {
      if (!jwkString || !jweString) {
        throw new Error("JWK and JWE inputs cannot be empty.");
      }

      const jwkObject = JSON.parse(jwkString);

      const res = await fetch("/api/jwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: jwkObject, token: jweString }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to decrypt JWE.");
      }

      const decryptedJws = data.id_token;
      setRawJWK(decryptedJws);
      if (typeof decryptedJws !== "string") {
        throw new Error("Decrypted token is not a valid string.");
      }

      const parts = decryptedJws.split(".");
      if (parts.length !== 3) {
        throw new Error("Decrypted token is not a valid JWT (JWS).");
      }

      const decodedHeader = JSON.parse(b64UrlDecode(parts[0]));
      const decodedPayload = JSON.parse(b64UrlDecode(parts[1]));

      setHeader(decodedHeader);
      setPayload(decodedPayload);
      toast.success("JWE decrypted successfully!");
    } catch (error: any) {
      console.error("Decryption failed:", error);
      toast.error(error.message || "An unknown error occurred.");
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="flex flex-row gap-4 p-4 h-[calc(100vh-120px)] w-full">
      <div className="flex flex-col w-1/2 gap-4">
        <div className="flex flex-col h-1/2 border rounded-lg">
          <div className="p-2 font-semibold border-b text-sm">Private JWK</div>
          <Textarea
            placeholder="Paste your private JWK (JSON Web Key) here"
            className="w-full h-full rounded-none border-none resize-none font-mono text-xs"
            value={jwkString}
            onChange={(e) => setJwkString(e.target.value)}
          />
        </div>
        <div className="flex flex-col h-1/2 border rounded-lg">
          <div className="p-2 font-semibold border-b text-sm">
            Encrypted Token (JWE)
          </div>
          <Textarea
            placeholder="Paste your compact JWE (JSON Web Encryption) string here"
            className="w-full h-full rounded-none border-none resize-none font-mono text-xs"
            value={jweString}
            onChange={(e) => setJweString(e.target.value)}
          />
        </div>
        <Button
          onClick={handleClick}
          disabled={isDecrypting}
          className="w-full"
        >
          {isDecrypting ? "Decrypting..." : "Decrypt"}
        </Button>
      </div>

      <div className="flex flex-col w-1/2 border rounded-lg">
        <div className="p-2 font-semibold border-b text-sm">
          Decrypted Token
        </div>
        <div className="p-4 space-y-4 overflow-auto">
          {!header && !payload ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Decrypted token content will appear here...
            </div>
          ) : (
            <>
              {header && (
                <ComponentCode
                  title="HEADER"
                  code={JSON.stringify(header, null, 2)}
                />
              )}
              {payload && (
                <ComponentCode
                  title="PAYLOAD"
                  code={JSON.stringify(payload, null, 2)}
                />
              )}
              <div className="p-4 bg-muted rounded-md text-muted-foreground overflow-x-auto whitespace-pre text-xs whitespace-pre-wrap break-all">
                {rawJWK}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
