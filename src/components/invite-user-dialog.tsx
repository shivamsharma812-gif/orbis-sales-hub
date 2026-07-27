import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { inviteUser } from "@/lib/admin.functions";

const DESIGNATIONS = [
  "MD & CEO",
  "President",
  "SVP",
  "VP",
  "AVP",
  "Senior Director",
  "Director",
  "Associate Director",
  "Senior Manager",
  "Manager",
  "Assistant Manager",
  "Senior Executive",
  "Executive",
];

interface UserOption {
  id: string;
  full_name: string;
  designation: string;
}

export function InviteUserDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    designation: "Manager",
    department: "Sales",
    reports_to_user_id: "",
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-for-invite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, designation")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as UserOption[];
    },
    enabled: open,
  });

  const invite = useServerFn(inviteUser);
  const mut = useMutation({
    mutationFn: async () =>
      invite({
        data: {
          ...form,
          reports_to_user_id: form.reports_to_user_id || null,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Failed to invite");
        return;
      }
      toast.success(`Invite sent to ${form.email}`);
      qc.invalidateQueries({ queryKey: ["users-all"] });
      setOpen(false);
      setForm({
        full_name: "",
        email: "",
        phone: "",
        designation: "Manager",
        department: "Sales",
        reports_to_user_id: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" /> Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
          <DialogDescription>
            They'll receive an email to set their password and sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Full name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label>Work email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
          </div>
          <div>
            <Label>Designation</Label>
            <Select
              value={form.designation}
              onValueChange={(v) => setForm({ ...form, designation: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESIGNATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reports to</Label>
            <Select
              value={form.reports_to_user_id || "none"}
              onValueChange={(v) =>
                setForm({ ...form, reports_to_user_id: v === "none" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (top of tree) —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} · {u.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!form.full_name || !form.email || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
