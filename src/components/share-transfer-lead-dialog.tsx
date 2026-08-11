import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const ELIGIBLE_DESIGNATIONS = ["President", "MD & CEO"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  currentOwnerId: string;
  currentCoOwnerId: string | null;
  currentUserDesignation: string;
}

export function ShareTransferLeadDialog({
  open,
  onOpenChange,
  leadId,
  currentOwnerId,
  currentCoOwnerId,
  currentUserDesignation,
}: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const myId = me?.id ?? null;
  const isCeo = (me?.designation ?? currentUserDesignation) === "MD & CEO";
  const [mode, setMode] = useState<"transfer" | "share">(isCeo ? "transfer" : "transfer");
  const [targetId, setTargetId] = useState<string>("");

  const { data: peers = [] } = useQuery({
    queryKey: ["president-peers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, designation")
        .in("designation", ELIGIBLE_DESIGNATIONS)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

  // CEO: show all Presidents (exclude MD & CEO themselves). Presidents: show only other Presidents (exclude self and CEO).
  const options = peers.filter((p) => {
    if (p.id === currentOwnerId) return false;
    if (isCeo) return p.designation === "President";
    // President user
    return p.designation === "President";
  });


  const apply = useMutation({
    mutationFn: async () => {
      if (!targetId) throw new Error("Pick a recipient");
      if (mode === "transfer") {
        const { error } = await supabase
          .from("leads")
          .update({ owner_id: targetId, co_owner_id: null } as never)
          .eq("id", leadId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("leads")
          .update({ co_owner_id: targetId } as never)
          .eq("id", leadId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "transfer" ? "Lead transferred" : "Lead shared — revenue split 50/50");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
      setTargetId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share or transfer lead</DialogTitle>
          <DialogDescription>
            Move this lead to another President, or share it so the estimated revenue is split 50/50
            and the lead appears on both accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCeo ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">Transfer lead</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                As MD &amp; CEO you can transfer this lead to any President. Sharing (50/50 split) is available only between Presidents.
              </p>
            </div>
          ) : (
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "transfer" | "share")}>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="transfer" id="mode-transfer" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="mode-transfer" className="font-medium">Transfer lead</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reassigns full ownership to another President. You lose access unless they share it back.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="share" id="mode-share" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="mode-share" className="font-medium">Share lead (split 50/50)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Both Presidents keep the lead on their account; estimated revenue is counted at 50% each.
                  </p>
                </div>
              </div>
            </RadioGroup>
          )}


          <div className="space-y-1.5">
            <Label>{mode === "transfer" ? "Transfer to" : "Share with"}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Select a President" /></SelectTrigger>
              <SelectContent>
                {options.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} · {u.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentCoOwnerId && mode === "share" && (
              <p className="text-xs text-muted-foreground">
                This lead is already co-owned. Picking someone new will replace the current co-owner.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={!targetId || apply.isPending}>
            {mode === "transfer" ? "Transfer lead" : "Share lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
