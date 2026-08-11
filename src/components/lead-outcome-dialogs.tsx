import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const SERVICE_OPTIONS = [
  "Custody & Allied Services",
  "PCM",
  "RTA",
  "Trusteeship",
  "Fund Accounting",
  "Fund Administration",
] as const;

export const LOST_REASONS = [
  "Requires bank custodian",
  "Lack of follow ups",
  "Inadequate Commercial quotations",
  "Other",
] as const;

export interface ConvertibleLead {
  id: string;
  company_name: string;
  client_type: string | null;
  owner_id: string;
  estimated_deal_value?: number | null;
  services?: string[] | null;
}

export function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: ConvertibleLead | null;
  onConverted?: (clientId: string) => void;
}) {
  const qc = useQueryClient();
  const [services, setServices] = useState<string[]>([]);

  useEffect(() => {
    if (open && lead) {
      const seeded = Array.isArray(lead.services)
        ? lead.services.filter((s) => (SERVICE_OPTIONS as readonly string[]).includes(s))
        : [];
      setServices(seeded);
    }
  }, [open, lead]);

  const convert = useMutation({
    mutationFn: async (selected: string[]) => {
      if (!lead) throw new Error("Lead missing");
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .insert({
          company_name: lead.company_name,
          client_type: lead.client_type,
          owner_id: lead.owner_id,
          originating_lead_id: lead.id,
          annual_revenue: lead.estimated_deal_value ?? 0,
          service_type: selected.length > 0 ? selected.join(", ") : null,
        })
        .select()
        .single();
      if (cErr) throw cErr;
      const { error: uErr } = await supabase
        .from("leads")
        .update({
          status: "won" as never,
          pipeline_stage: "Onboarding" as never,
          converted_client_id: client.id,
        })
        .eq("id", lead.id);
      if (uErr) throw uErr;
      return client;
    },
    onSuccess: (client) => {
      toast.success("Converted to client");
      qc.invalidateQueries();
      onOpenChange(false);
      onConverted?.(client.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to client{lead ? ` — ${lead.company_name}` : ""}</DialogTitle>
          <DialogDescription>
            Select the services this mandate has been signed for. These will show on the client record.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {SERVICE_OPTIONS.map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-md border p-2.5">
              <Checkbox
                id={`mandate-${s}`}
                checked={services.includes(s)}
                onCheckedChange={(c) =>
                  setServices((prev) => (c ? [...prev, s] : prev.filter((x) => x !== s)))
                }
              />
              <Label htmlFor={`mandate-${s}`} className="font-normal cursor-pointer">
                {s}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => convert.mutate(services)}
            disabled={services.length === 0 || convert.isPending}
          >
            Convert to client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MarkLostDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string | null;
  leadName?: string;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");

  useEffect(() => {
    if (open) {
      setChoice("");
      setOther("");
    }
  }, [open]);

  const markLost = useMutation({
    mutationFn: async (reason: string) => {
      if (!leadId) throw new Error("Lead missing");
      const { error } = await supabase
        .from("leads")
        .update({
          status: "lost" as never,
          pipeline_stage: "Lost" as never,
          lost_reason: reason,
          lost_at: new Date().toISOString(),
        } as never)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked lost");
      qc.invalidateQueries({ queryKey: ["leads"] });
      if (leadId) qc.invalidateQueries({ queryKey: ["lead", leadId] });
      onOpenChange(false);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark lead as lost{leadName ? ` — ${leadName}` : ""}</DialogTitle>
          <DialogDescription>
            Select why this lead was lost. This helps track patterns and improve win rates.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <RadioGroup value={choice} onValueChange={setChoice}>
            {LOST_REASONS.map((r) => (
              <div key={r} className="flex items-center gap-2 rounded-md border p-2.5">
                <RadioGroupItem value={r} id={`lost-${r}`} />
                <Label htmlFor={`lost-${r}`} className="font-normal cursor-pointer">
                  {r}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {choice === "Other" && (
            <div className="space-y-1.5">
              <Label htmlFor="lost-other">Please specify</Label>
              <Textarea
                id="lost-other"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="e.g. Chose competitor on pricing, timing not right, budget cut…"
                rows={4}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => markLost.mutate(choice === "Other" ? other.trim() : choice)}
            disabled={!choice || (choice === "Other" && !other.trim()) || markLost.isPending}
          >
            Mark lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
