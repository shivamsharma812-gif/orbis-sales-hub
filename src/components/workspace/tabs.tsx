import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAssignableUsers } from "@/hooks/use-assignable-users";

import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";
import {
  formatDate,
  formatDateTime,
  relativeDay,
  toLocalInputValue,
  fromLocalInputValue,
} from "@/lib/format";
import { ParticipantPicker, type Participant } from "@/components/participant-picker";
import {
  Plus,
  User,
  CalendarClock,
  BellRing,
  ClipboardList,
  StickyNote,
  Clock,
  FileUp,
  Trash2,
  Download,
  Pencil,
  FileText,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PIPELINE_STAGES } from "@/components/stage-badge";
import { softDeleteWithUndo } from "@/lib/soft-delete";

// Advance a lead's pipeline_stage forward only (never regress).
async function advanceLeadStage(leadId: string, targetStage: string) {
  const { data: lead } = await supabase
    .from("leads")
    .select("pipeline_stage, status")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || lead.status !== "active") return;
  const currentIdx = PIPELINE_STAGES.indexOf(lead.pipeline_stage as never);
  const targetIdx = PIPELINE_STAGES.indexOf(targetStage as never);
  if (targetIdx > currentIdx) {
    await supabase
      .from("leads")
      .update({ pipeline_stage: targetStage as never })
      .eq("id", leadId);
  }
}

type ParentType = "lead" | "client";
interface WorkspaceProps {
  parentType: ParentType;
  parentId: string;
  ownerId: string;
  /** Render only the create dialog (used by global Quick Actions). */
  formOnly?: boolean;
  /** Controlled open state for the create dialog. */
  openOverride?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Appended to the dialog title, e.g. " — Tata Asset Management". */
  titleSuffix?: string;
}

/* ---------------- Contacts ---------------- */
export function ContactsTab({ parentType, parentId, formOnly, openOverride, onOpenChange, titleSuffix }: WorkspaceProps) {
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const open = openOverride ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyForm = { name: "", designation: "", department: "", email: "", phone: "", is_primary: false };
  const [form, setForm] = useState(emptyForm);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("is_primary", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("contacts").update(form).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert({
          parent_type: parentType as never,
          parent_id: parentId,
          ...form,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", parentType, parentId] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Contact updated" : "Contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", parentType, parentId] });
      toast.success("Contact deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (c: typeof contacts[number]) => {
    setEditingId(c.id);
    setForm({
      name: c.name ?? "",
      designation: c.designation ?? "",
      department: c.department ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      is_primary: !!c.is_primary,
    });
    setOpen(true);
  };

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (!o) { setEditingId(null); setForm(emptyForm); }
  };

  const createDialog = (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!formOnly && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> Add contact</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader><DialogTitle>{(editingId ? "Edit contact" : "Add contact") + (titleSuffix ?? "")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} />
            Primary contact
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>{editingId ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (formOnly) return createDialog;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <User className="w-4 h-4" /> Contacts ({contacts.length})
        </div>
        {createDialog}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No contacts yet.</TableCell></TableRow>
          )}
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                {c.name}
                {c.is_primary && <Badge variant="secondary" className="ml-2">Primary</Badge>}
              </TableCell>
              <TableCell className="text-muted-foreground">{c.designation}</TableCell>
              <TableCell className="text-muted-foreground">{c.email}</TableCell>
              <TableCell className="text-muted-foreground">{c.phone}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this contact?")) del.mutate(c.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------------- Meetings ---------------- */
export function MeetingsTab({ parentType, parentId, ownerId, formOnly, openOverride, onOpenChange, titleSuffix }: WorkspaceProps) {
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const open = openOverride ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const [form, setForm] = useState({
    meeting_date: "",
    meeting_type: "In-Person",
    agenda: "",
    duration_minutes: "30",
    attendees: [] as Participant[],
  });

  const [editing, setEditing] = useState<MeetingRowType | null>(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("name, email")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("is_primary", { ascending: false });
      return (data ?? []).filter((c) => c.email) as { name: string | null; email: string }[];
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("meeting_date", { ascending: false });
      return data ?? [];
    },
  });

  const resetForm = () =>
    setForm({ meeting_date: "", meeting_type: "In-Person", agenda: "", duration_minutes: "30", attendees: [] });

  const create = useMutation({
    mutationFn: async () => {
      const { data: inserted, error } = await supabase
        .from("meetings")
        .insert({
          parent_type: parentType as never,
          parent_id: parentId,
          owner_id: ownerId,
          meeting_date: fromLocalInputValue(form.meeting_date),
          meeting_type: form.meeting_type,
          agenda: form.agenda,
          duration_minutes: Number(form.duration_minutes) || 30,
          attendees: form.attendees as any,
          status: "scheduled" as never,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (parentType === "lead") await advanceLeadStage(parentId, "Meeting Scheduled");
      return inserted.id as string;
    },
    onSuccess: async (id) => {
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["lead", parentId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      resetForm();
      toast.success("Meeting scheduled");
      const { pushMeetingToOutlook } = await import("@/lib/outlook.functions");
      const result = await pushMeetingToOutlook({ data: { meetingId: id } });
      if (!result.ok && result.error) toast.error(`Outlook: ${result.error}`);
      else if (result.ok) toast.success("Synced to Outlook");
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (values: Partial<MeetingRowType>) => {
      if (!editing) return;
      const { error } = await supabase.from("meetings").update(values).eq("id", editing.id);
      if (error) throw error;
      return editing.id;
    },
    onSuccess: async (id) => {
      if (!id) return;
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
      setEditing(null);
      toast.success("Meeting updated");
      const { pushMeetingToOutlook } = await import("@/lib/outlook.functions");
      const result = await pushMeetingToOutlook({ data: { meetingId: id } });
      if (!result.ok && result.error) toast.error(`Outlook: ${result.error}`);
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async ({ id, summary, actions }: { id: string; summary: string; actions: string }) => {
      const { error } = await supabase
        .from("meetings")
        .update({ status: "completed" as never, discussion_summary: summary, action_items: actions })
        .eq("id", id);
      if (error) throw error;
      if (parentType === "lead") await advanceLeadStage(parentId, "Meeting Completed");
      return id;
    },
    onSuccess: async (id) => {
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
      qc.invalidateQueries({ queryKey: ["lead", parentId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      const { pushMeetingToOutlook } = await import("@/lib/outlook.functions");
      await pushMeetingToOutlook({ data: { meetingId: id } });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { deleteOutlookMeeting } = await import("@/lib/outlook.functions");
      await deleteOutlookMeeting({ data: { meetingId: id } });
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
      toast.success("Meeting deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAttendee = (email: string, name?: string | null) => {
    const exists = form.attendees.some((a) => a.email === email);
    if (exists) {
      setForm({ ...form, attendees: form.attendees.filter((a) => a.email !== email) });
    } else {
      setForm({ ...form, attendees: [...form.attendees, { email, name: name ?? undefined }] });
    }
  };


  const createDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      {!formOnly && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> Schedule</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{"Schedule meeting" + (titleSuffix ?? "")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date &amp; time</Label><Input type="datetime-local" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["In-Person","Video Call","Phone Call"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Agenda</Label><Textarea rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></div>
          {contacts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Invite attendees</Label>
              <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
                {contacts.map((c) => (
                  <label key={c.email} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.attendees.some((a) => a.email === c.email)}
                      onChange={() => toggleAttendee(c.email, c.name)}
                    />
                    <span>{c.name ?? c.email}</span>
                    <span className="text-muted-foreground text-xs">{c.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <ParticipantPicker
            autoAddSelf
            value={form.attendees}
            onChange={(next) => setForm({ ...form, attendees: next })}
          />


        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.meeting_date || create.isPending}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (formOnly) return createDialog;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4" /> Meetings ({meetings.length})
        </div>
        {createDialog}
      </div>
      <div className="divide-y divide-border">

        {meetings.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">You have been sitting on your desk for long enough, Hustle up soldier :)</div>
        )}
        {meetings.map((m) => (
          <MeetingRow
            key={m.id}
            m={m}
            contacts={contacts}
            onComplete={(summary, actions) => complete.mutate({ id: m.id, summary, actions })}
            onDelete={() => { if (confirm("Delete this meeting?")) del.mutate(m.id); }}
            onEdit={() => setEditing(m)}
          />
        ))}
      </div>
      {editing && (
        <EditMeetingDialog
          meeting={editing}
          contacts={contacts}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSave={(values) => update.mutate(values)}
          isPending={update.isPending}
        />
      )}
    </Card>
  );
}

type MeetingRowType = Database["public"]["Tables"]["meetings"]["Row"];

function MeetingRow({
  m,
  contacts,
  onComplete,
  onDelete,
  onEdit,
}: {
  m: MeetingRowType;
  contacts: { name: string | null; email: string }[];
  onComplete: (summary: string, actions: string) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [completeOpen, setCompleteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [summary, setSummary] = useState(m.discussion_summary ?? "");
  const [actions, setActions] = useState(m.action_items ?? "");
  const attendees = ((m.attendees ?? []) as { email: string; name?: string }[]).length;

  const syncNow = async () => {
    const { syncMeetingFromOutlook } = await import("@/lib/outlook.functions");
    const result = await syncMeetingFromOutlook({ data: { meetingId: m.id } });
    if (!result.ok && result.error) toast.error(`Sync failed: ${result.error}`);
    else toast.success("Synced from Outlook");
    qc.invalidateQueries({ queryKey: ["meetings", m.parent_type, m.parent_id] });
  };

  const syncStatus = m.outlook_event_id
    ? m.outlook_sync_error
      ? "Sync failed"
      : "Synced"
    : "Not connected";

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{m.agenda ?? "Meeting"}</div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(m.meeting_date)} · {m.meeting_type}
            {m.duration_minutes ? ` · ${m.duration_minutes} min` : ""}
            {attendees > 0 ? ` · ${attendees} invitee${attendees > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {m.status !== "cancelled" && (
            <Badge variant={m.status === "completed" ? "secondary" : "outline"}>
              {m.status ? m.status.charAt(0).toUpperCase() + m.status.slice(1) : m.status}
            </Badge>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" title="View meeting notes" onClick={() => setNotesOpen(true)}>
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {m.discussion_summary &&
        (m.status === "cancelled" ? (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap">{m.discussion_summary}</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">{m.discussion_summary}</div>
        ))}
      {m.action_items && (
        <div className="mt-1 text-xs">
          <span className="font-medium">Action items: </span>
          <span className="text-muted-foreground">{m.action_items}</span>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Badge variant={syncStatus === "Synced" ? "secondary" : syncStatus === "Sync failed" ? "destructive" : "outline"} className="text-xs">
          {syncStatus}
        </Badge>
        {m.outlook_event_id && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={syncNow}>Sync now</Button>
        )}
      </div>
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Meeting notes</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {formatDateTime(m.meeting_date)} · {m.meeting_type}
            </div>
            {m.status === "cancelled" && (
              <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 text-destructive text-xs">
                <AlertTriangle className="w-3.5 h-3.5" /> Meeting not done
              </Badge>
            )}
            {m.discussion_summary ? (
              <div className={`whitespace-pre-wrap${m.status === "cancelled" ? " text-destructive" : ""}`}>
                {m.discussion_summary}
              </div>
            ) : (
              <div className="text-muted-foreground">No notes recorded for this meeting.</div>
            )}
            {m.action_items && (
              <div>
                <div className="font-medium">Next steps / action items</div>
                <div className="text-muted-foreground whitespace-pre-wrap">{m.action_items}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {m.status === "scheduled" && (
        <>
          <Button size="sm" variant="ghost" className="mt-2 h-7" onClick={() => setCompleteOpen(true)}>
            Mark completed
          </Button>
          <MinutesOfMeetingDialog
            meeting={{
              id: m.id,
              parent_type: m.parent_type as "lead" | "client",
              parent_id: m.parent_id,
              meeting_date: m.meeting_date,
              meeting_type: m.meeting_type,
              agenda: m.agenda,
              duration_minutes: m.duration_minutes,
              discussion_summary: m.discussion_summary,
              action_items: m.action_items,
              attendees: m.attendees,
              parent_name: parentName,
            }}
            open={completeOpen}
            onOpenChange={setCompleteOpen}
            onSaved={onComplete}
          />
        </>
      )}
    </div>
  );
}

function EditMeetingDialog({
  meeting,
  contacts,
  open,
  onOpenChange,
  onSave,
  isPending,
}: {
  meeting: MeetingRowType;
  contacts: { name: string | null; email: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: Partial<MeetingRowType>) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    meeting_date: toLocalInputValue(meeting.meeting_date),
    meeting_type: meeting.meeting_type,
    agenda: meeting.agenda ?? "",
    duration_minutes: String(meeting.duration_minutes ?? 30),
    attendees: ((meeting.attendees ?? []) as unknown as Participant[]).map((a): Participant => ({
      email: a.email,
      name: a.name,
    })),
    discussion_summary: meeting.discussion_summary ?? "",
    action_items: meeting.action_items ?? "",
  });

  const toggleAttendee = (email: string, name?: string | null) => {
    if (form.attendees.some((a) => a.email === email)) {
      setForm({ ...form, attendees: form.attendees.filter((a) => a.email !== email) });
    } else {
      setForm({ ...form, attendees: [...form.attendees, { email, name: name ?? undefined }] });
    }
  };

  const handleSave = () => {
    onSave({
      meeting_date: fromLocalInputValue(form.meeting_date),
      meeting_type: form.meeting_type,
      agenda: form.agenda,
      duration_minutes: Number(form.duration_minutes) || 30,
      attendees: form.attendees as any,
      discussion_summary: form.discussion_summary,
      action_items: form.action_items,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit meeting</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date &amp; time</Label><Input type="datetime-local" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["In-Person","Video Call","Phone Call"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Agenda</Label><Textarea rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></div>
          {contacts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Invite attendees</Label>
              <div className="border rounded-md p-2 space-y-1 max-h-32 overflow-y-auto">
                {contacts.map((c) => (
                  <label key={c.email} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.attendees.some((a) => a.email === c.email)} onChange={() => toggleAttendee(c.email, c.name)} />
                    <span>{c.name ?? c.email}</span>
                    <span className="text-muted-foreground text-xs">{c.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <ParticipantPicker
            value={form.attendees}
            onChange={(next) => setForm({ ...form, attendees: next })}
          />
          <div className="space-y-1.5"><Label>Meeting notes</Label><Textarea rows={3} value={form.discussion_summary} onChange={(e) => setForm({ ...form, discussion_summary: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Action items</Label><Textarea rows={2} value={form.action_items} onChange={(e) => setForm({ ...form, action_items: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Follow-ups ---------------- */
export function FollowupsTab({ parentType, parentId, ownerId, formOnly, openOverride, onOpenChange, titleSuffix }: WorkspaceProps) {
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const open = openOverride ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const emptyForm = { due_date: "", priority: "medium", description: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: currentUser } = useCurrentUser();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["followups", parentType, parentId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const { data: followups = [] } = useQuery({
    queryKey: ["followups", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("followups")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .eq("is_deleted", false)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.due_date) throw new Error("A due date is required");
      const payload = {
        due_date: form.due_date,
        priority: form.priority as never,
        description: form.description,
      };
      if (editingId) {
        const { error } = await supabase.from("followups").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("followups").insert({
          parent_type: parentType as never,
          parent_id: parentId,
          owner_id: ownerId,
          status: "pending" as never,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      const wasEdit = !!editingId;
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(wasEdit ? "Follow-up updated" : "Follow-up created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("followups")
        .update({ status: "completed" as never, completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("followups")
        .update({ status: "pending" as never, completed_at: null, completion_notes: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Follow-up marked as pending"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = (id: string) =>
    softDeleteWithUndo({
      table: "followups",
      id,
      label: "Follow-up",
      actorId: currentUser?.id,
      onChanged: invalidate,
    });

  const openEdit = (f: typeof followups[number]) => {
    setEditingId(f.id);
    setForm({
      due_date: f.due_date ?? "",
      priority: f.priority ?? "medium",
      description: f.description ?? "",
    });
    setOpen(true);
  };

  const today = new Date().toISOString().split("T")[0];
  const pending = followups.filter((f) => f.status === "pending");
  const completed = followups.filter((f) => f.status === "completed");

  const createDialog = (
    <Dialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}
    >
      {!formOnly && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> New follow-up</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader><DialogTitle>{(editingId ? "Edit follow-up" : "Create follow-up") + (titleSuffix ?? "")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low","medium","high"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); setForm(emptyForm); }}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.due_date || save.isPending}>{editingId ? "Save changes" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (formOnly) return createDialog;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <BellRing className="w-4 h-4" /> Follow-ups ({followups.length})
        </div>
        {createDialog}
      </div>
      <div className="divide-y divide-border">
        {pending.length === 0 && completed.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No follow-ups yet.</div>
        )}
        {pending.map((f) => {
          const overdue = f.due_date < today;
          return (
            <div key={f.id} className="p-3 flex items-start gap-3">
              <input type="checkbox" onChange={() => complete.mutate(f.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{f.description}</div>
                <div className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {relativeDay(f.due_date)} · {f.priority} priority
                </div>
              </div>
              {overdue && <Badge variant="destructive">Overdue</Badge>}
              <Button size="sm" variant="ghost" aria-label="Edit follow-up" onClick={() => openEdit(f)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Delete follow-up" onClick={() => remove(f.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          );
        })}
        {completed.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-xs text-muted-foreground bg-surface-2">Completed</div>
            {completed.map((f) => (
              <div key={f.id} className="p-3 flex items-start gap-3 opacity-60">
                <input
                  type="checkbox"
                  checked
                  aria-label="Mark follow-up as pending"
                  onChange={() => reopen.mutate(f.id)}
                  className="mt-1 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm line-through">{f.description}</div>
                  <div className="text-xs text-muted-foreground">
                    Completed {formatDate(f.completed_at)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" aria-label="Edit follow-up" onClick={() => openEdit(f)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete follow-up" onClick={() => remove(f.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}


/* ---------------- Tasks ---------------- */
export function TasksTab({ parentType, parentId, ownerId, formOnly, openOverride, onOpenChange, titleSuffix }: WorkspaceProps) {
  const qc = useQueryClient();
  const [openState, setOpenState] = useState(false);
  const open = openOverride ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const emptyForm = {
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    assigned_to: ownerId,
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: currentUser } = useCurrentUser();

  // Only the current user's own reporting downline can be assigned work.
  const { data: users = [] } = useAssignableUsers();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks", parentType, parentId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .eq("is_deleted", false)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("A title is required");
      const payload = {
        assigned_to: form.assigned_to,
        title: form.title,
        description: form.description,
        due_date: form.due_date || null,
        priority: form.priority as never,
      };
      if (editingId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({
          parent_type: parentType as never,
          parent_id: parentId,
          owner_id: ownerId,
          status: "open" as never,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      const wasEdit = !!editingId;
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(wasEdit ? "Task updated" : "Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const next = current === "completed" ? "open" : "completed";
      const { error } = await supabase.from("tasks").update({ status: next as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = (id: string) =>
    softDeleteWithUndo({
      table: "tasks",
      id,
      label: "Task",
      actorId: currentUser?.id,
      onChanged: invalidate,
    });

  const openEdit = (t: typeof tasks[number]) => {
    setEditingId(t.id);
    setForm({
      title: t.title ?? "",
      description: t.description ?? "",
      due_date: t.due_date ?? "",
      priority: t.priority ?? "medium",
      assigned_to: t.assigned_to ?? ownerId,
    });
    setOpen(true);
  };


  const createDialog = (
    <Dialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}
    >
      {!formOnly && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> New task</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader><DialogTitle>{(editingId ? "Edit task" : "Create task") + (titleSuffix ?? "")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); setForm(emptyForm); }}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>{editingId ? "Save changes" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (formOnly) return createDialog;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Tasks ({tasks.length})
        </div>
        {createDialog}
      </div>
      <div className="divide-y divide-border">
        {tasks.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No tasks yet.</div>
        )}
        {tasks.map((t) => (
          <div key={t.id} className="p-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={t.status === "completed"}
              onChange={() => toggleStatus.mutate({ id: t.id, current: t.status })}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                {t.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.due_date ? relativeDay(t.due_date) : "No due date"} · {t.priority} · {users.find((u) => u.id === t.assigned_to)?.full_name ?? "—"}
              </div>
            </div>
            <Button size="sm" variant="ghost" aria-label="Edit task" onClick={() => openEdit(t)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Delete task" onClick={() => remove(t.id)}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Notes ---------------- */
export function NotesTab({ parentType, parentId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const { data: currentUser } = useCurrentUser();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notes", parentType, parentId] });

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!currentUser) throw new Error("Not signed in");
      if (!body.trim()) throw new Error("Note cannot be empty");
      const { error } = await supabase.from("notes").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: currentUser.id,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setBody("");
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      if (!editBody.trim()) throw new Error("Note cannot be empty");
      const { error } = await supabase.from("notes").update({ body: editBody }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setEditBody("");
      toast.success("Note updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = (id: string) =>
    softDeleteWithUndo({
      table: "notes",
      id,
      label: "Note",
      actorId: currentUser?.id,
      onChanged: invalidate,
    });

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4" /> Notes ({notes.length})
      </div>
      <div className="space-y-2">
        <Textarea rows={3} placeholder="Add a note…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => create.mutate()} disabled={!body.trim() || create.isPending || !currentUser}>
            Add note
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {notes.map((n) => {
          const isMine = currentUser && n.owner_id === currentUser.id;
          const isEditing = editingId === n.id;
          return (
            <div key={n.id} className="border-l-2 border-primary pl-3 py-1 flex items-start justify-between gap-2 group">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditBody(""); }}>Cancel</Button>
                      <Button size="sm" onClick={() => update.mutate()} disabled={!editBody.trim() || update.isPending}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(n.created_at)}</div>
                  </>
                )}
              </div>
              {isMine && !isEditing && (
                <div className="flex items-center opacity-0 group-hover:opacity-100">
                  <Button size="sm" variant="ghost" aria-label="Edit note" onClick={() => { setEditingId(n.id); setEditBody(n.body ?? ""); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Delete note" onClick={() => remove(n.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {notes.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">No notes yet.</div>
        )}
      </div>
    </Card>
  );
}


/* ---------------- Timeline (activity) ---------------- */
export function TimelineTab({ parentType, parentId }: WorkspaceProps) {
  const { data: activity = [] } = useQuery({
    queryKey: ["activity", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*, users!activity_log_actor_id_fkey(full_name)")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4" /> Activity timeline
      </div>
      <div className="space-y-3">
        {activity.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">No activity yet.</div>
        )}
        {activity.map((a) => {
          const actor = (a as unknown as { users?: { full_name: string } }).users;
          return (
            <div key={a.id} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium">{a.action}</span>
                  {a.metadata && Object.keys(a.metadata as object).length > 0 && false && (
                    <span className="text-muted-foreground text-xs ml-2">
                      {JSON.stringify(a.metadata)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {actor?.full_name ?? "System"} · {formatDateTime(a.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- Documents ---------------- */
export function DocumentsTab({ parentType, parentId, formOnly, openOverride, onOpenChange, titleSuffix }: WorkspaceProps) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const { data: currentUser } = useCurrentUser();

  const { data: docs = [] } = useQuery({
    queryKey: ["documents", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, users!documents_owner_id_fkey(full_name)")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleUpload(file: File) {
    if (!currentUser) {
      toast.error("Not signed in");
      return;
    }
    setUploading(true);
    try {
      const path = `${parentType}/${parentId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("documents").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: currentUser.id,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (dbErr) throw dbErr;
      qc.invalidateQueries({ queryKey: ["documents", parentType, parentId] });
      toast.success("Uploaded");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleView(path: string) {
    const { data, error } = await supabase.storage.from("crm-documents").createSignedUrl(path, 600);
    if (error || !data) return toast.error(error?.message ?? "Failed to open document");
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const officeExts = ["doc", "docx", "xls", "xlsx", "xlsm", "csv", "ppt", "pptx"];
    const url = officeExts.includes(ext)
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.signedUrl)}`
      : data.signedUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  }


  async function handleDownload(path: string, name: string) {
    const { data, error } = await supabase.storage.from("crm-documents").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  }

  async function handleDelete(id: string, path: string) {
    if (!confirm("Delete this document?")) return;
    await supabase.storage.from("crm-documents").remove([path]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["documents", parentType, parentId] });
    }
  }

  if (formOnly) {
    return (
      <Dialog open={openOverride ?? false} onOpenChange={(o) => onOpenChange?.(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{"Upload document" + (titleSuffix ?? "")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>File</Label>
            <Input
              type="file"
              disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                await handleUpload(f);
                onOpenChange?.(false);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {uploading ? "Uploading…" : "The document will be attached to this record."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <FileUp className="w-4 h-4" /> Documents ({docs.length})
        </div>
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            disabled={uploading}
          />
          <Button size="sm" variant="outline" asChild>
            <span><Plus className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload"}</span>
          </Button>
        </label>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Uploaded by</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No documents yet.</TableCell></TableRow>
          )}
          {docs.map((d) => {
            const uploader = (d as unknown as { users?: { full_name: string } }).users;
            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.file_name}</TableCell>
                <TableCell className="text-muted-foreground">{uploader?.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(d.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" title="View" onClick={() => handleView(d.storage_path)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" title="Download" onClick={() => handleDownload(d.storage_path, d.file_name)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(d.id, d.storage_path)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
