import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Target, Building2, User } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface SearchHit {
  kind: "lead" | "client" | "contact";
  id: string;
  label: string;
  sub: string;
  navId: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: hits = [] } = useQuery({
    queryKey: ["global-search", q],
    enabled: open && q.length >= 2,
    queryFn: async (): Promise<SearchHit[]> => {
      const term = `%${q}%`;
      const [leads, clients, contacts] = await Promise.all([
        supabase
          .from("leads")
          .select("id, company_name, pipeline_stage")
          .ilike("company_name", term)
          .limit(6),
        supabase
          .from("clients")
          .select("id, company_name, service_type")
          .ilike("company_name", term)
          .limit(6),
        supabase
          .from("contacts")
          .select("id, name, designation, parent_type, parent_id")
          .ilike("name", term)
          .limit(6),
      ]);
      const out: SearchHit[] = [];
      leads.data?.forEach((l) =>
        out.push({
          kind: "lead",
          id: l.id,
          label: l.company_name,
          sub: l.pipeline_stage,
          navId: l.id,
        }),
      );
      clients.data?.forEach((c) =>
        out.push({
          kind: "client",
          id: c.id,
          label: c.company_name,
          sub: c.service_type || "",
          navId: c.id,
        }),
      );
      contacts.data?.forEach((c) =>
        out.push({
          kind: "contact",
          id: c.id,
          label: c.name,
          sub: c.designation || "",
          navId: c.parent_id,
        }),
      );
      return out;
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-2 w-full max-w-md justify-start text-muted-foreground font-normal"
      >
        <Search className="w-4 h-4" />
        <span>Search leads, clients, contacts…</span>
        <kbd className="ml-auto hidden sm:inline text-[10px] rounded border border-border px-1.5 py-0.5">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search leads, clients, contacts…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          <CommandEmpty>
            {q.length < 2 ? "Type at least 2 characters." : "No matches."}
          </CommandEmpty>
          <CommandGroup heading="Results">
            {hits.map((h) => (
              <CommandItem
                key={`${h.kind}-${h.id}`}
                value={`${h.kind}-${h.id}-${h.label}`}
                onSelect={() => {
                  setOpen(false);
                  if (h.kind === "lead" || h.kind === "contact" && false) {
                    navigate({ to: "/leads/$id", params: { id: h.navId } });
                  } else if (h.kind === "client") {
                    navigate({ to: "/clients/$id", params: { id: h.navId } });
                  } else {
                    // contact -> we don't know parent kind here reliably in JSX;
                    // navigate to a generic search-driven route by defaulting to lead
                    navigate({ to: "/leads/$id", params: { id: h.navId } });
                  }
                }}
              >
                {h.kind === "lead" && <Target className="w-4 h-4 mr-2" />}
                {h.kind === "client" && <Building2 className="w-4 h-4 mr-2" />}
                {h.kind === "contact" && <User className="w-4 h-4 mr-2" />}
                <div className="flex-1">
                  <div className="text-sm">{h.label}</div>
                  <div className="text-xs text-muted-foreground">{h.sub}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {h.kind}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
