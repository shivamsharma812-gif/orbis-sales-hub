import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BusinessFields } from "@/components/business-fields";
import {
  BusinessFormState,
  businessToClientColumns,
  businessToLeadColumns,
  rowToBusinessForm,
  validateBusinessForm,
} from "@/lib/business-fields";
import { toast } from "sonner";

/**
 * Edit dialog shared by the pipeline (lead) and client detail pages. The same
 * field set is used for both; the client variant never touches `status`.
 */
export function EditRecordDialog({
  kind,
  row,
  open,
  onOpenChange,
}: {
  kind: "lead" | "client";
  row: Record<string, unknown>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [form, setForm] = useState<BusinessFormState>(() => rowToBusinessForm(row, kind));
  const qc = useQueryClient();

  const update = <K extends keyof BusinessFormState>(k: K, v: BusinessFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleOpen = (o: boolean) => {
    if (o) setForm(rowToBusinessForm(row, kind));
    onOpenChange(o);
  };

  const errors = validateBusinessForm(form);

  const save = useMutation({
    mutationFn: async () => {
      const id = row["id"] as string;
      const payload = kind === "lead" ? businessToLeadColumns(form) : businessToClientColumns(form);
      const { error } = await supabase
        .from(kind === "lead" ? "leads" : "clients")
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(kind === "lead" ? "Lead updated" : "Client updated");
      qc.invalidateQueries({ queryKey: [kind === "lead" ? "lead" : "client"] });
      qc.invalidateQueries({ queryKey: [kind === "lead" ? "leads" : "clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind === "lead" ? "Edit lead" : "Edit client"}</DialogTitle>
          <DialogDescription>Update the record details.</DialogDescription>
        </DialogHeader>
        <BusinessFields
          form={form}
          update={update}
          showProbability={kind === "lead"}
          showState={kind === "lead"}
          showAddress={kind === "client"}
        />
        {errors.length > 0 && (
          <ul className="text-xs text-destructive space-y-0.5">
            {errors.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={errors.length > 0 || save.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
