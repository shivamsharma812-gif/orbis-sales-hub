import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Orbis Automation" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { role: "MD & CEO", email: "ceo@orbis.demo", name: "Shyamsunder Agarwal" },
  { role: "President", email: "president@orbis.demo", name: "Rishav Bagrecha" },
  { role: "Senior VP", email: "svp@orbis.demo", name: "Murlidhar Bakshi" },
  { role: "Deputy Manager", email: "rm@orbis.demo", name: "Hamza Qazi" },
];

const DEMO_PASSWORD = "Orbis@2026";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function ensureDemoUsers() {
    setBootstrapping(true);
    try {
      const res = await fetch("/api/public/bootstrap-demo-users", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Bootstrap failed";
      toast.error(message);
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Best-effort: create the demo accounts on first sign-in so the shared
    // credentials always work in a fresh environment.
    await ensureDemoUsers();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-primary/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">ORBIS AUTOMATION</div>
            <div className="text-xs text-sidebar-foreground/60">Internal Operating Platform</div>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Sales CRM</h1>
          <p className="mt-3 text-sidebar-foreground/70 max-w-md text-sm">
            Centralize the complete sales lifecycle — leads, meetings, follow-ups, and
            pipeline — while preserving Orbis's reporting hierarchy.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-sidebar-foreground/60 max-w-md">
            <div>
              <div className="text-sidebar-foreground font-medium">Hierarchy aware</div>
              Access follows the reporting tree.
            </div>
            <div>
              <div className="text-sidebar-foreground font-medium">Auditable</div>
              Every action logged permanently.
            </div>
            <div>
              <div className="text-sidebar-foreground font-medium">Client-centric</div>
              One workspace per relationship.
            </div>
            <div>
              <div className="text-sidebar-foreground font-medium">Real-time</div>
              Dashboards calculated live.
            </div>
          </div>
        </div>
        <div className="text-xs text-sidebar-foreground/40">
          © {new Date().getFullYear()} Orbis Financial Corporation
        </div>
      </div>

      {/* Right sign-in */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold">Orbis Automation</div>
              <div className="text-xs text-muted-foreground">Sales CRM</div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold">Sign in to your account</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Use your Orbis credentials or a demo account below.
          </p>

          <form onSubmit={handleSignIn} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@orbis.demo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || bootstrapping}>
              {loading ? "Signing in…" : bootstrapping ? "Preparing…" : "Sign in"}
            </Button>
          </form>

          <Card className="mt-8 p-4 bg-surface-2 border-dashed">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Demo accounts
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Shared password: <code className="font-mono">{DEMO_PASSWORD}</code>
            </div>
            <div className="mt-3 grid gap-1.5">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d.email)}
                  className="flex items-center justify-between text-left px-2.5 py-1.5 rounded hover:bg-accent transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.role}</div>
                  </div>
                  <code className="text-xs text-muted-foreground font-mono">{d.email}</code>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
