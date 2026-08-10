import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Target, Building2 } from "lucide-react";

export interface PickedRecord {
  parentType: "lead" | "client";
  parentId: string;
  ownerId: string;
  companyName: string;
}

interface Row extends PickedRecord {
  stage: string;
  rm: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function RecordPickerDialog({
  open,
  onOpenChange,
  title,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onPick: (record: PickedRecord) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim();

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["quick-action-records", term],
    enabled: open,
    queryFn: async (): Promise<Row[]> => {
      const like = `%${term}%`;

      // Contacts matching by name → resolve their parent lead/client ids.
      let contactLeadIds: string[] = [];
      let contactClientIds: string[] = [];
      if (term.length >= 2) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("parent_type, parent_id")
          .ilike("name", like)
          .limit(50);
        contactLeadIds = (contacts ?? []).filter((c) => c.parent_type === "lead").map((c) => c.parent_id);
        contactClientIds = (contacts ?? []).filter((c) => c.parent_type === "client").map((c) => c.parent_id);
      }

      const leadSelect = "id, company_name, pipeline_stage, owner_id, users!leads_owner_id_fkey(full_name)";
      const clientSelect = "id, company_name, status, owner_id, users!clients_owner_id_fkey(full_name)";

      const leadQuery = supabase.from("leads").select(leadSelect).eq("status", "active");
      const clientQuery = supabase.from("clients").select(clientSelect).eq("status", "active");

      if (term) {
        const idPart = UUID_RE.test(term) ? `,id.eq.${term}` : "";
        leadQuery.or(`company_name.ilike.${like}${idPart}`);
        clientQuery.or(`company_name.ilike.${like}${idPart}`);
      }

      const [leadsRes, clientsRes, leadsByContact, clientsByContact] = await Promise.all([
        leadQuery.order("created_at", { ascending: false }).limit(20),
        clientQuery.order("created_at", { ascending: false }).limit(20),
        contactLeadIds.length
          ? supabase.from("leads").select(leadSelect).in("id", contactLeadIds).limit(20)
          : Promise.resolve({ data: [] as unknown[] }),
        contactClientIds.length
          ? supabase.from("clients").select(clientSelect).in("id", contactClientIds).limit(20)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

      type LeadRow = {
        id: string;
        company_name: string;
        pipeline_stage: string;
        owner_id: string;
        users?: { full_name: string } | null;
      };
      type ClientRow = {
        id: string;
        company_name: string;
        status: string;
        owner_id: string;
        users?: { full_name: string } | null;
      };

      const out: Row[] = [];
      const seen = new Set<string>();
      const pushLead = (l: LeadRow) => {
        if (seen.has(`lead-${l.id}`)) return;
        seen.add(`lead-${l.id}`);
        out.push({
          parentType: "lead",
          parentId: l.id,
          ownerId: l.owner_id,
          companyName: l.company_name,
          stage: l.pipeline_stage,
          rm: l.users?.full_name ?? "—",
        });
      };
      const pushClient = (c: ClientRow) => {
        if (seen.has(`client-${c.id}`)) return;
        seen.add(`client-${c.id}`);
        out.push({
          parentType: "client",
          parentId: c.id,
          ownerId: c.owner_id,
          companyName: c.company_name,
          stage: c.status,
          rm: c.users?.full_name ?? "—",
        });
      };

      ((leadsRes.data ?? []) as unknown as LeadRow[]).forEach(pushLead);
      ((leadsByContact.data ?? []) as unknown as LeadRow[]).forEach(pushLead);
      ((clientsRes.data ?? []) as unknown as ClientRow[]).forEach(pushClient);
      ((clientsByContact.data ?? []) as unknown as ClientRow[]).forEach(pushClient);

      return out;
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ("");
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Search by company name, contact name or record ID.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-8"
            placeholder="Search leads and clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-border border border-border rounded-md">
          {rows.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {isFetching ? "Searching…" : "No matching records."}
            </div>
          )}
          {rows.map((r) => (
            <button
              key={`${r.parentType}-${r.parentId}`}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-center gap-3"
              onClick={() => {
                onPick({
                  parentType: r.parentType,
                  parentId: r.parentId,
                  ownerId: r.ownerId,
                  companyName: r.companyName,
                });
                setQ("");
              }}
            >
              {r.parentType === "lead" ? (
                <Target className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.companyName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.stage} · RM {r.rm}
                </div>
              </div>
              <Badge variant="secondary" className="capitalize shrink-0">
                {r.parentType}
              </Badge>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
