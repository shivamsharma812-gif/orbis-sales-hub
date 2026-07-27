import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/auth/set-password")({
  head: () => ({
    meta: [
      { title: "Set your password — Orbis Automation" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Supabase invite links land here with tokens in the URL hash and
    // supabase-js auto-parses them. Wait for the session, then unlock the form.
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (data.user) {
        setEmail(data.user.email ?? null);
        setReady(true);
        return;
      }
      // Listen for the parsed invite token turning into a session.
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (session?.user) {
          setEmail(session.user.email ?? null);
          setReady(true);
        }
      });
      return () => sub.subscription.unsubscribe();
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password set. Welcome to Orbis.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <div className="font-semibold">Orbis Automation</div>
        </div>
        <h1 className="text-xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {email
            ? `Choose a password for ${email}. You'll use this to sign in.`
            : "Verifying your invite link…"}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="pw">New password</Label>
            <Input
              id="pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={!ready}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="pw2">Confirm password</Label>
            <Input
              id="pw2"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              disabled={!ready}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || saving}>
            {saving ? "Saving…" : "Set password & sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
