import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, X, Check } from "lucide-react";
import { initials } from "@/lib/format";

export interface Participant {
  email: string;
  name?: string;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees-directory"],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, designation")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []).filter((u) => !!u.email) as Employee[];
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Searchable employee picker for meeting participants. Shows an avatar, the
 * employee name and their email address for each row.
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q),
    );
  }, [employees, query]);

  const toggle = (e: Employee) => {
    const exists = value.some((p) => p.email.toLowerCase() === e.email.toLowerCase());
    if (exists) {
      onChange(value.filter((p) => p.email.toLowerCase() !== e.email.toLowerCase()));
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
            <Badge key={p.email} variant="secondary" className="gap-1 pr-1">
              {p.name ?? p.email}
              <button
                type="button"
                aria-label={`Remove ${p.name ?? p.email}`}
                onClick={() => onChange(value.filter((x) => x.email !== p.email))}
                className="rounded-sm hover:bg-muted p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search employees by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="border rounded-md max-h-48 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground p-3 text-center">No employees found.</div>
        )}
        {filtered.map((e) => {
          const selected = value.some((p) => p.email.toLowerCase() === e.email.toLowerCase());
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
                <div className="text-xs text-muted-foreground truncate">{e.email}</div>
              </div>
              {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
