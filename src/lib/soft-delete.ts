import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SoftTable = "followups" | "tasks" | "notes";

/**
 * Soft-deletes a record and shows a toast with an Undo action that restores
 * the very same row (never creates a duplicate).
 */
export async function softDeleteWithUndo({
  table,
  id,
  label,
  actorId,
  onChanged,
}: {
  table: SoftTable;
  id: string;
  label: string;
  actorId?: string | null;
  onChanged: () => void;
}) {
  const { error } = await supabase
    .from(table)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: actorId ?? null,
    } as never)
    .eq("id", id)
    .eq("is_deleted", false);
  if (error) {
    toast.error(error.message);
    return;
  }
  onChanged();
  toast.success(`${label} deleted`, {
    action: {
      label: "Undo",
      onClick: async () => {
        const { error: rErr } = await supabase
          .from(table)
          .update({ is_deleted: false, deleted_at: null, deleted_by: null } as never)
          .eq("id", id);
        if (rErr) {
          toast.error(rErr.message);
          return;
        }
        onChanged();
        toast.success(`${label} restored`);
      },
    },
  });
}
