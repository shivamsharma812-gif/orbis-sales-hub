import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { formatDate, formatDateTime, relativeDay } from "@/lib/format";
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
} from "lucide-react";

type ParentType = "lead" | "client";
interface WorkspaceProps {
  parentType: ParentType;
  parentId: string;
  ownerId: string;
}

/* ---------------- Contacts ---------------- */
export function ContactsTab({ parentType, parentId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    designation: "",
    department: "",
    email: "",
    phone: "",
    is_primary: false,
  });

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

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", parentType, parentId] });
      setOpen(false);
      setForm({ name: "", designation: "", department: "", email: "", phone: "", is_primary: false });
      toast.success("Contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <User className="w-4 h-4" /> Contacts ({contacts.length})
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> Add contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
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
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No contacts yet.</TableCell></TableRow>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ---------------- Meetings ---------------- */
export function MeetingsTab({ parentType, parentId, ownerId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    meeting_date: "",
    meeting_type: "In-Person",
    agenda: "",
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

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: ownerId,
        meeting_date: form.meeting_date,
        meeting_type: form.meeting_type,
        agenda: form.agenda,
        status: "scheduled" as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({ meeting_date: "", meeting_type: "In-Person", agenda: "" });
      toast.success("Meeting scheduled");
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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings", parentType, parentId] }),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4" /> Meetings ({meetings.length})
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> Schedule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule meeting</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Date &amp; time</Label><Input type="datetime-local" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["In-Person","Video Call","Phone Call"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Agenda</Label><Textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.meeting_date || create.isPending}>Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="divide-y divide-border">
        {meetings.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">No meetings yet.</div>
        )}
        {meetings.map((m) => (
          <MeetingRow key={m.id} m={m} onComplete={(summary, actions) => complete.mutate({ id: m.id, summary, actions })} />
        ))}
      </div>
    </Card>
  );
}

function MeetingRow({
  m,
  onComplete,
}: {
  m: { id: string; meeting_date: string; meeting_type: string; status: string; agenda: string | null; discussion_summary: string | null; action_items: string | null };
  onComplete: (summary: string, actions: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState("");
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{m.agenda ?? "Meeting"}</div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(m.meeting_date)} · {m.meeting_type}
          </div>
        </div>
        <Badge variant={m.status === "completed" ? "secondary" : "outline"}>{m.status}</Badge>
      </div>
      {m.discussion_summary && (
        <div className="mt-2 text-sm text-muted-foreground">{m.discussion_summary}</div>
      )}
      {m.action_items && (
        <div className="mt-1 text-xs">
          <span className="font-medium">Action items: </span>
          <span className="text-muted-foreground">{m.action_items}</span>
        </div>
      )}
      {m.status !== "completed" && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="mt-2 h-7">Mark completed</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Complete meeting</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Discussion summary</Label><Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Action items</Label><Textarea rows={2} value={actions} onChange={(e) => setActions(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => { onComplete(summary, actions); setOpen(false); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Follow-ups ---------------- */
export function FollowupsTab({ parentType, parentId, ownerId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ due_date: "", priority: "medium", description: "" });

  const { data: followups = [] } = useQuery({
    queryKey: ["followups", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("followups")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("followups").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: ownerId,
        due_date: form.due_date,
        priority: form.priority as never,
        description: form.description,
        status: "pending" as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followups", parentType, parentId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({ due_date: "", priority: "medium", description: "" });
      toast.success("Follow-up created");
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followups", parentType, parentId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const pending = followups.filter((f) => f.status === "pending");
  const completed = followups.filter((f) => f.status === "completed");

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <BellRing className="w-4 h-4" /> Follow-ups ({followups.length})
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> New follow-up</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create follow-up</DialogTitle></DialogHeader>
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
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.due_date || create.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            </div>
          );
        })}
        {completed.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-xs text-muted-foreground bg-surface-2">Completed</div>
            {completed.map((f) => (
              <div key={f.id} className="p-3 flex items-start gap-3 opacity-60">
                <input type="checkbox" checked readOnly className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm line-through">{f.description}</div>
                  <div className="text-xs text-muted-foreground">
                    Completed {formatDate(f.completed_at)}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Tasks ---------------- */
export function TasksTab({ parentType, parentId, ownerId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    assigned_to: ownerId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name");
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: ownerId,
        assigned_to: form.assigned_to,
        title: form.title,
        description: form.description,
        due_date: form.due_date || null,
        priority: form.priority as never,
        status: "open" as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", parentType, parentId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({ title: "", description: "", due_date: "", priority: "medium", assigned_to: ownerId });
      toast.success("Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const next = current === "completed" ? "open" : "completed";
      const { error } = await supabase.from("tasks").update({ status: next as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", parentType, parentId] }),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Tasks ({tasks.length})
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-4 h-4" /> New task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
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
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Notes (append-only) ---------------- */
export function NotesTab({ parentType, parentId, ownerId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", parentType, parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("parent_type", parentType as never)
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notes").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: ownerId,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", parentType, parentId] });
      setBody("");
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4" /> Notes ({notes.length})
      </div>
      <div className="space-y-2">
        <Textarea rows={3} placeholder="Add a note…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => create.mutate()} disabled={!body.trim() || create.isPending}>
            Add note
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="border-l-2 border-primary pl-3 py-1">
            <div className="text-sm">{n.body}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(n.created_at)}</div>
          </div>
        ))}
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
                  {a.metadata && Object.keys(a.metadata as object).length > 0 && (
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
export function DocumentsTab({ parentType, parentId, ownerId }: WorkspaceProps) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    try {
      const path = `${parentType}/${parentId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("crm-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("documents").insert({
        parent_type: parentType as never,
        parent_id: parentId,
        owner_id: ownerId,
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
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(d.storage_path, d.file_name)}>
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
