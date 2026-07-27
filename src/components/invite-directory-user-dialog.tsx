import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteExistingUser } from "@/lib/admin.functions";

interface Props {
  user: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
}

const PLACEHOLDER_DOMAINS = ["orbis.demo", "example.com"];

export function InviteDirectoryUserDialog({ user }: Props) {
  const [open, setOpen] = useState(false);
  const isPlaceholder = PLACEHOLDER_DOMAINS.some((d) =>
    user.email?.toLowerCase().endsWith(`@${d}`),
  );
  const [email, setEmail] = useState(isPlaceholder ? "" : user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");

  const qc = useQueryClient();
  const invite = useServerFn(inviteExistingUser);
  const mut = useMutation({
    mutationFn: () =>
      invite({ data: { user_id: user.id, email: email.trim().toLowerCase(), phone: phone.trim() || null } }),
    onSuccess: (r) => {
      if (!r.ok) return toast.error(r.error ?? "Failed to invite");
      toast.success(`Invite sent to ${email}`);
      qc.invalidateQueries({ queryKey: ["users-all"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Invite to portal">
          <Mail className="h-4 w-4 mr-1.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {user.full_name}</DialogTitle>
          <DialogDescription>
            Enter their work email and phone number. They'll receive an invite to set
            their password and access the portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@orbisfinancial.com"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-phone">Phone number</Label>
            <Input
              id="invite-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98xxxxxxxx"
              maxLength={32}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
