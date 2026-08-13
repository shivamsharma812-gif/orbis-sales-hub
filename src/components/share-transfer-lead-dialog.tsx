import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useEndOwners } from "@/hooks/use-end-owners";
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
  /** "lead" (pipeline) or "client" */
  entity?: "lead" | "client";
  leadId: string;
  ownerId: string;
  currentEndOwnerId: string | null;
  currentCoOwnerId: string | null;
  currentUserDesignation: string;
}

export function ShareTransferLeadDialog({
  open,
  onOpenChange,
  entity = "lead",
  leadId,
  ownerId,
  currentEndOwnerId,
  currentCoOwnerId,
  currentUserDesignation,
}: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { hierarchyEndOwnerId, userName } = useEndOwners();
  const myId = me?.id ?? null;
  const isCeo = (me?.designation ?? currentUserDesignation) === "MD & CEO";
  const [mode, setMode] = useState<"transfer" | "share">("transfer");
  const [targetId, setTargetId] = useState<string>("");

  const table = entity === "client" ? "clients" : "leads";
  const label = entity === "client" ? "client" : "lead";
  const effectiveEndOwnerId = currentEndOwnerId ?? hierarchyEndOwnerId(ownerId);

  // Presidents can't see each other through the normal directory (vertical RBAC),
  // so the eligible recipients come from a security-definer lookup instead.
  const { data: peers = [] } = useQuery({
    queryKey: ["end-ownership-targets", myId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_end_ownership_targets");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; designation: string | null }[];
    },
  });

  // Never offer the current end owner or (when sharing) the existing co-owner.
  const options = peers.filter((p) => {
    if (p.id === effectiveEndOwnerId) return false;
    if (myId && p.id === myId) return false;
    if (mode === "share" && p.id === currentCoOwnerId) return false;
    return true;
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!targetId) throw new Error("Pick a recipient");
      if (targetId === myId) throw new Error(`You can't transfer or share a ${label} with yourself`);
      if (targetId === effectiveEndOwnerId)
        throw new Error(`That person is already the end owner of this ${label}`);
      const patch =
        mode === "transfer"
          ? { end_owner_id: targetId, co_owner_id: null }
          : { end_owner_id: effectiveEndOwnerId, co_owner_id: targetId };
      const { error } = await supabase
        .from(table)
        .update(patch as never)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        mode === "transfer"
          ? "End ownership transferred"
          : "End ownership shared — revenue split 50/50",
      );
      qc.invalidateQueries({ queryKey: [entity, leadId] });
      qc.invalidateQueries({ queryKey: [entity === "client" ? "clients" : "leads"] });
      onOpenChange(false);
      setTargetId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share or transfer end ownership</DialogTitle>
          <DialogDescription>
            End ownership sits with the President a {label} ultimately rolls up to. Transfer it to
            another President, or share it so the revenue is split 50/50 and the {label} counts on
            both accounts. The day-to-day owner stays unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Current end owner
            </div>
            <div className="font-medium mt-0.5">
              {userName(effectiveEndOwnerId) ?? "—"}
              {!currentEndOwnerId && effectiveEndOwnerId && (
                <span className="text-xs text-muted-foreground font-normal"> · from hierarchy</span>
              )}
            </div>
            {currentCoOwnerId && (
              <div className="text-xs text-muted-foreground mt-1">
                Shared 50/50 with {userName(currentCoOwnerId) ?? "another President"}
              </div>
            )}
          </div>

          {isCeo ? (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">Transfer end ownership</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                As MD &amp; CEO you can transfer end ownership to any President. Sharing (50/50
                split) is available only between Presidents.
              </p>
            </div>
          ) : (
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "transfer" | "share")}>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="transfer" id="mode-transfer" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="mode-transfer" className="font-medium">Transfer end ownership</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hands full end ownership to another President. You lose access unless they share
                    it back.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="share" id="mode-share" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="mode-share" className="font-medium">Share end ownership (50/50)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Both Presidents keep the {label} on their account; revenue is counted at 50%
                    each.
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
                This {label} is already co-owned. Picking someone new will replace the current
                co-owner.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={!targetId || apply.isPending}>
            {mode === "transfer" ? "Transfer end ownership" : "Share end ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
