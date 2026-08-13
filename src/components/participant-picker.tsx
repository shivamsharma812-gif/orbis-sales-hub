import { useEffect, useMemo, useRef, useState } from "react";
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
      const all = (data ?? []) as (Employee & { reports_to_user_id: string | null })[];
      // The current user, everyone below them, and their management chain
      // upwards (stopping at the President — i.e. excluding the top of the tree).
      const byId = new Map(all.map((u) => [u.id, u]));
      const childrenOf = new Map<string, typeof all>();
      for (const u of all) {
        const p = u.reports_to_user_id ?? "";
        if (!childrenOf.has(p)) childrenOf.set(p, []);
        childrenOf.get(p)!.push(u);
      }
      const meId = me!.id;
      const picked = new Map<string, (typeof all)[number]>();
      const meRow = byId.get(meId);
      if (meRow) picked.set(meId, meRow);
      const stack = [meId];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const child of childrenOf.get(cur) ?? []) {
          if (picked.has(child.id)) continue;
          picked.set(child.id, child);
          stack.push(child.id);
        }
      }
      // Walk upwards; skip the top of the tree (CEO has no manager).
      let cursor = meRow?.reports_to_user_id ?? null;
      let guard = 0;
      while (cursor && guard++ < 20) {
        const mgr = byId.get(cursor);
        if (!mgr) break;
        if (mgr.reports_to_user_id === null) break; // top of tree — stop before CEO
        picked.set(mgr.id, mgr);
        cursor = mgr.reports_to_user_id;
      }
      return [...picked.values()]
        .filter((u) => !!u.email)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)) as Employee[];
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
