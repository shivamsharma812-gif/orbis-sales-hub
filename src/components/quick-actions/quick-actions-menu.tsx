import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Target,
  Building2,
  CalendarClock,
  BellRing,
  ClipboardList,
  User,
  FileUp,
} from "lucide-react";
import { CreateLeadWizard } from "@/components/create-lead-wizard";
import { CreateClientDialog } from "@/routes/_authenticated/clients.index";
import {
  ContactsTab,
  MeetingsTab,
  FollowupsTab,
  TasksTab,
  DocumentsTab,
} from "@/components/workspace/tabs";
import { RecordPickerDialog, type PickedRecord } from "./record-picker-dialog";

type ActionKind =
  | "lead"
  | "client"
  | "meeting"
  | "followup"
  | "task"
  | "contact"
  | "document";

const RECORD_ACTIONS: Record<string, { label: string; icon: typeof Plus }> = {
  meeting: { label: "Schedule Meeting", icon: CalendarClock },
  followup: { label: "Create Follow-up", icon: BellRing },
  task: { label: "Create Task", icon: ClipboardList },
  contact: { label: "Add Contact", icon: User },
  document: { label: "Upload Document", icon: FileUp },
};

/** Reads the lead/client currently open in the workspace, if any. */
function useWorkspaceContext() {
  const match = useRouterState({
    select: (s) =>
      s.matches.find(
        (m) =>
          m.routeId === "/_authenticated/leads/$id" ||
          m.routeId === "/_authenticated/clients/$id",
      ),
  });
  const parentType: "lead" | "client" | null = match
    ? match.routeId.includes("leads")
      ? "lead"
      : "client"
    : null;
  const parentId = (match?.params as { id?: string } | undefined)?.id ?? null;

  const { data } = useQuery({
    queryKey: ["quick-action-context", parentType, parentId],
    enabled: !!parentType && !!parentId,
    queryFn: async (): Promise<PickedRecord | null> => {
      const table = parentType === "lead" ? "leads" : "clients";
      const { data: row } = await supabase
        .from(table)
        .select("id, company_name, owner_id")
        .eq("id", parentId!)
        .maybeSingle();
      if (!row) return null;
      return {
        parentType: parentType!,
        parentId: row.id,
        ownerId: row.owner_id,
        companyName: row.company_name,
      };
    },
  });

  return data ?? null;
}

export function QuickActionsMenu() {
  const context = useWorkspaceContext();
  const [action, setAction] = useState<ActionKind | null>(null);
  const [record, setRecord] = useState<PickedRecord | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function reset() {
    setAction(null);
    setRecord(null);
    setPickerOpen(false);
  }

  function trigger(kind: ActionKind) {
    setAction(kind);
    if (kind === "lead" || kind === "client") {
      setRecord(null);
      setPickerOpen(false);
      return;
    }
    if (context) {
      setRecord(context);
      setPickerOpen(false);
    } else {
      setRecord(null);
      setPickerOpen(true);
    }
  }

  const recordAction = action && action in RECORD_ACTIONS ? action : null;
  const suffix = record ? ` — ${record.companyName}` : "";
  const sharedProps = record
    ? {
        parentType: record.parentType,
        parentId: record.parentId,
        ownerId: record.ownerId,
        formOnly: true as const,
        openOverride: true,
        onOpenChange: (o: boolean) => {
          if (!o) reset();
        },
        titleSuffix: suffix,
      }
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Quick Action
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {context ? `In context: ${context.companyName}` : "Create anything"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => trigger("lead")}>
            <Target className="w-4 h-4 mr-2" /> Create Lead
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => trigger("client")}>
            <Building2 className="w-4 h-4 mr-2" /> Add Client
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {Object.entries(RECORD_ACTIONS).map(([kind, { label, icon: Icon }]) => (
            <DropdownMenuItem key={kind} onSelect={() => trigger(kind as ActionKind)}>
              <Icon className="w-4 h-4 mr-2" /> {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {action === "lead" && (
        <CreateLeadWizard
          hideTrigger
          openOverride
          onOpenChange={(o) => {
            if (!o) reset();
          }}
        />
      )}
      {action === "client" && (
        <CreateClientDialog
          hideTrigger
          openOverride
          onOpenChange={(o) => {
            if (!o) reset();
          }}
        />
      )}

      {recordAction && !record && (
        <RecordPickerDialog
          open={pickerOpen}
          onOpenChange={(o) => {
            if (!o) reset();
          }}
          title={`${RECORD_ACTIONS[recordAction].label} — pick a lead or client`}
          onPick={(r) => {
            setRecord(r);
            setPickerOpen(false);
          }}
        />
      )}

      {recordAction && sharedProps && (
        <>
          {recordAction === "meeting" && <MeetingsTab {...sharedProps} />}
          {recordAction === "followup" && <FollowupsTab {...sharedProps} />}
          {recordAction === "task" && <TasksTab {...sharedProps} />}
          {recordAction === "contact" && <ContactsTab {...sharedProps} />}
          {recordAction === "document" && <DocumentsTab {...sharedProps} />}
        </>
      )}
    </>
  );
}
