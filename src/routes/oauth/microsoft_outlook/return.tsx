import { useEffect, useState } from "react";
import { completeOutlookConnect } from "@/lib/outlook.functions";

export const Route = createFileRoute("/oauth/microsoft_outlook/return")({
  head: () => ({
    meta: [
      { title: "Connecting Outlook — Orbis Automation" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OutlookOAuthReturn,
});

function OutlookOAuthReturn() {
  const [message, setMessage] = useState("Finishing Outlook connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpener = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      error?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "microsoft_outlook", error },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      const err = params.get("error") ?? "Outlook OAuth did not complete.";
      setMessage(err);
      notifyOpener("appUserConnectorOAuthFailed", err);
      return;
    }

    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notifyOpener("appUserConnectorOAuthComplete");
        return;
      }
      const err = "OAuth completed without an exchange code.";
      setMessage(err);
      notifyOpener("appUserConnectorOAuthFailed", err);
      return;
    }

    void completeOutlookConnect({ data: { code } })
      .then(() => notifyOpener("appUserConnectorOAuthComplete"))
      .catch((e) => {
        const err = e instanceof Error ? e.message : String(e);
        setMessage("Could not finish the Outlook connection.");
        notifyOpener("appUserConnectorOAuthFailed", err);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
