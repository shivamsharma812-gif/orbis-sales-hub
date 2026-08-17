import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface MomMeeting {
  id: string;
  parent_type: "lead" | "client";
  parent_id: string;
  meeting_date: string;
  meeting_type: string;
  agenda: string | null;
  duration_minutes: number | null;
  discussion_summary?: string | null;
  action_items?: string | null;
  attendees?: unknown;
  parent_name?: string;
}

/** Structured minutes-of-meeting capture. Stored on the meeting record. */
export function MinutesOfMeetingDialog({
  meeting,
  open,
  onOpenChange,
  onSaved,
}: {
  meeting: MomMeeting | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (meetingId: string) => void;
}) {
  const qc = useQueryClient();
  const [counterparty, setCounterparty] = useState("");
  const [date, setDate] = useState("");
  const [theirParticipants, setTheirParticipants] = useState("");
  const [orbisParticipants, setOrbisParticipants] = useState("");
  const [background, setBackground] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  useEffect(() => {
    if (!meeting) return;
    const parsed = parseMinutes(meeting.discussion_summary);
    setCounterparty(parsed.counterparty || meeting.parent_name || "");
    setDate(parsed.date || meeting.meeting_date.slice(0, 10));
    setTheirParticipants(parsed.theirParticipants ?? "");
    const attendees = Array.isArray(meeting.attendees) ? (meeting.attendees as { name?: string; email?: string }[]) : [];
    setOrbisParticipants(parsed.orbisParticipants || attendees.map((a) => a.name ?? a.email ?? "").filter(Boolean).join(", "));
    setBackground(parsed.background || meeting.agenda || "");
    setKeyPoints(parsed.keyPoints ?? "");
    setNextSteps(meeting.action_items || parsed.nextSteps || "");
  }, [meeting]);

  const save = useMutation({
    mutationFn: async () => {
      if (!meeting) return;
      const summary = [
        `Prospect / Client / Intermediary: ${counterparty || "—"}`,
        `Date: ${date || "—"}`,
        `Prospect / Client / Intermediary participants: ${theirParticipants || "—"}`,
        `Orbis participants: ${orbisParticipants || "—"}`,
        "",
        `Background:\n${background || "—"}`,
        "",
        `Key points discussed:\n${keyPoints || "—"}`,
      ].join("\n");

      const { error } = await supabase
        .from("meetings")
        .update({
          discussion_summary: summary,
          action_items: nextSteps || null,
          status: "completed",
        })
        .eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Minutes of the meeting saved");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      if (meeting) onSaved?.(meeting.id);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Minutes of the Meeting</DialogTitle>
          <DialogDescription>
            Capture the record of the meeting. Saving marks the meeting completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prospect / Client / Intermediary (name)</Label>
              <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Prospect / Client / Intermediary participants</Label>
            <Input
              value={theirParticipants}
              onChange={(e) => setTheirParticipants(e.target.value)}
              placeholder="Names, comma separated"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Orbis participants</Label>
            <Input
              value={orbisParticipants}
              onChange={(e) => setOrbisParticipants(e.target.value)}
              placeholder="Names, comma separated"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Background</Label>
            <Textarea rows={3} value={background} onChange={(e) => setBackground(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Key points discussed</Label>
            <Textarea rows={5} value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Next steps</Label>
            <Textarea rows={3} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save minutes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
