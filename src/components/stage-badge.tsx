import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const stageColors: Record<string, string> = {
  Prospect: "bg-muted text-muted-foreground",
  Contacted: "bg-info/15 text-info border-info/25",
  "Meeting Scheduled": "bg-chart-2/15 text-chart-2 border-chart-2/25",
  "Meeting Completed": "bg-chart-2/20 text-chart-2 border-chart-2/30",
  "Proposal Sent": "bg-chart-4/20 text-warning border-warning/30",
  Negotiation: "bg-chart-4/25 text-warning border-warning/30",
  Onboarding: "bg-primary/15 text-primary border-primary/25",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", stageColors[stage] ?? "bg-muted text-muted-foreground")}
    >
      {stage}
    </Badge>
  );
}

export const PIPELINE_STAGES = [
  "Prospect",
  "Contacted",
  "Meeting Scheduled",
  "Meeting Completed",
  "Proposal Sent",
  "Negotiation",
  "Onboarding",
] as const;

// Active stages shown on the Kanban board — all simplified stages are visible.
export const ACTIVE_STAGES = [...PIPELINE_STAGES];
