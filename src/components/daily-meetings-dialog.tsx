import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";

interface TodayMeeting {
  id: string;
  parent_type: "lead" | "client";
  parent_id: string;
  meeting_date: string;
  meeting_type: string;
  agenda: string | null;
  duration_minutes: number | null;
}

/**
 * Shows the day's meetings the first time a user signs in on any given day.
 * "First login today" is decided server-side by public.record_user_login(),
 * which also stamps last_login_at / last_active_at for the inactivity job.
 */
export function DailyMeetingsDialog() {
  const { data: me } = useCurrentUser();
  const [firstLoginToday, setFirstLoginToday] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.rpc as any)("record_user_login");
      if (!cancelled && !error && data === true) setFirstLoginToday(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: meetings } = useQuery({
    queryKey: ["daily-meetings", me?.id],
    enabled: firstLoginToday && !!me?.id,
    queryFn: async (): Promise<TodayMeeting[]> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const base = () =>
        supabase
          .from("meetings")
          .select("id, parent_type, parent_id, meeting_date, meeting_type, agenda, duration_minutes")
          .gte("meeting_date", start.toISOString())
          .lte("meeting_date", end.toISOString())
          .neq("status", "cancelled");

      const [mine, invited] = await Promise.all([
        base().eq("owner_id", me!.id),
        me?.email ? base().contains("attendees", [{ email: me.email }]) : Promise.resolve({ data: [] }),
      ]);

      const rows = [...((mine.data ?? []) as TodayMeeting[]), ...(((invited as any).data ?? []) as TodayMeeting[])];
      const unique = new Map(rows.map((r) => [r.id, r]));
      return [...unique.values()].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    },
  });

  useEffect(() => {
    if (firstLoginToday && meetings && meetings.length > 0) setOpen(true);
  }, [firstLoginToday, meetings]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Your meetings today
          </DialogTitle>
          <DialogDescription>
            {meetings?.length} meeting{(meetings?.length ?? 0) > 1 ? "s" : ""} scheduled for today.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border">
          {meetings?.map((m) => (
            <Link
              key={m.id}
              to={m.parent_type === "lead" ? "/leads/$id" : "/clients/$id"}
              params={{ id: m.parent_id }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded hover:bg-accent"
            >
              <div className="text-sm font-mono text-muted-foreground w-14 shrink-0">
                {new Date(m.meeting_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{m.agenda ?? "Meeting"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.meeting_type}
                  {m.duration_minutes ? ` · ${m.duration_minutes} min` : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
