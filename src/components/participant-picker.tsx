import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, X, Check, Plus } from "lucide-react";
import { initials } from "@/lib/format";

export interface Participant {
  email?: string;
  name?: string;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
}

export function useEmployees() {
  const { data: me } = useCurrentUser();
  return useQuery({
    queryKey: ["employees-directory", me?.id],
    enabled: !!me?.id,
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, designation, reports_to_user_id")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      type Row = Employee & { reports_to_user_id: string | null };
      const all = (data ?? []) as Row[];
      const byId = new Map(all.map((u) => [u.id, u]));
      const childrenOf = new Map<string, Row[]>();
      for (const u of all) {
        const p = u.reports_to_user_id ?? "";
        if (!childrenOf.has(p)) childrenOf.set(p, []);
        childrenOf.get(p)!.push(u);
      }
      const meId = me!.id;

      // Walk up to the head of this user's vertical (top-most manager below the CEO).
      let top = byId.get(meId);
      let guard = 0;
      while (top && guard++ < 20) {
        const mgr = top.reports_to_user_id ? byId.get(top.reports_to_user_id) : undefined;
        if (!mgr) break; // manager not visible or top of tree
        if (!mgr.reports_to_user_id) break; // manager is the CEO → `top` is the President
        top = mgr;
      }

      // Everyone in that vertical: the head + their whole downline (peers included),
      // plus the current user and their own downline as a fallback.
      const allowedIds = new Set<string>([meId]);
      const stack = [top?.id ?? meId, meId];
      while (stack.length) {
        const cur = stack.pop()!;
        allowedIds.add(cur);
        for (const child of childrenOf.get(cur) ?? []) {
          if (!allowedIds.has(child.id)) stack.push(child.id);
        }
      }
      // Managers above the user, up to the vertical head.
      let node = byId.get(meId);
      guard = 0;
      while (node?.reports_to_user_id && guard++ < 20) {
        const mgr = byId.get(node.reports_to_user_id);
        if (!mgr) break;
        allowedIds.add(mgr.id);
        if (mgr.id === top?.id) break;
        node = mgr;
      }

      return all.filter((u) => allowedIds.has(u.id) && !!u.email) as Employee[];
    },
    staleTime: 5 * 60_000,
  });
}



/**
 * Searchable employee picker for meeting participants. Shows an avatar, the
 * employee name and their email address for each row. Also allows free-text
 * external participants to be added by name.
 */
export function ParticipantPicker({
  value,
  onChange,
  label = "Add participants",
}: {
  value: Participant[];
  onChange: (next: Participant[]) => void;
  label?: string;
}) {
  const { data: employees = [] } = useEmployees();
  const [query, setQuery] = useState("");
  const [freeTextName, setFreeTextName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.full_name.toLowerCase().includes(q),
    );
  }, [employees, query]);

  const addFreeTextParticipant = () => {
    const name = freeTextName.trim();
    if (!name) return;
    const duplicate = value.some(
      (p) => p.name?.toLowerCase() === name.toLowerCase() && !p.email,
    );
    if (duplicate) {
      setFreeTextName("");
      return;
    }
    onChange([...value, { name }]);
    setFreeTextName("");
  };

  const removeParticipant = (participant: Participant) => {
    if (participant.email) {
      onChange(value.filter((p) => p.email?.toLowerCase() !== participant.email!.toLowerCase()));
    } else {
      onChange(
        value.filter(
          (p) => !(p.name === participant.name && !p.email),
        ),
      );
    }
  };

  const toggle = (e: Employee) => {
    const exists = value.some((p) => p.email?.toLowerCase() === e.email.toLowerCase());
    if (exists) {
      onChange(value.filter((p) => p.email?.toLowerCase() !== e.email.toLowerCase()));
    } else {
      onChange([...value, { email: e.email, name: e.full_name }]);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <Badge key={p.email ?? p.name} variant="secondary" className="gap-1 pr-1">
              {p.name ?? p.email}
              <button
                type="button"
                aria-label={`Remove ${p.name ?? p.email}`}
                onClick={() => removeParticipant(p)}
                className="rounded-sm hover:bg-muted p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Enter participant name"
          value={freeTextName}
          onChange={(e) => setFreeTextName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFreeTextParticipant();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addFreeTextParticipant}
          disabled={!freeTextName.trim()}
          aria-label="Add participant"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search employees by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="border rounded-md max-h-48 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground p-3 text-center">No employees found.</div>
        )}
        {filtered.map((e) => {
          const selected = value.some((p) => p.email?.toLowerCase() === e.email.toLowerCase());
          return (
            <button
              type="button"
              key={e.id}
              onClick={() => toggle(e)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left hover:bg-accent"
            >
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-[10px]">{initials(e.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{e.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{e.designation}</div>
              </div>
              {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
