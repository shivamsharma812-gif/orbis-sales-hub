import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableUsers } from "@/hooks/use-assignable-users";
import {
  BusinessFormState,
  CATEGORIES_HIDE_STATE,
  CLIENT_CATEGORIES,
  COUNTRIES,
  LEAD_SOURCES,
  PROBABILITY_LABELS,
  SERVICES,
  SUB_CATEGORIES,
} from "@/lib/business-fields";

/**
 * Shared field set used by lead create/edit and client create/edit so the two
 * record types always capture exactly the same business information.
 */
export function BusinessFields({
  form,
  update,
  showProbability = true,
  showState = true,
  showAddress = false,
}: {
  form: BusinessFormState;
  update: <K extends keyof BusinessFormState>(k: K, v: BusinessFormState[K]) => void;
  showProbability?: boolean;
  showState?: boolean;
  showAddress?: boolean;
}) {
  const { data: assignable = [] } = useAssignableUsers();
  const subCategoryOptions = SUB_CATEGORIES[form.client_category] ?? [];
  const isOther = form.client_category === "Other";
  const hideState = CATEGORIES_HIDE_STATE.has(form.client_category) || !showState;

  const toggleService = (s: string) =>
    update(
      "services",
      form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s],
    );

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label>Company name *</Label>
          <Input
            value={form.company_name}
            onChange={(e) => update("company_name", e.target.value)}
            placeholder="Legal entity name"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Client category *</Label>
          <Select
            value={form.client_category}
            onValueChange={(v) => {
              update("client_category", v);
              update("sub_category", "");
            }}
          >
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {CLIENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {subCategoryOptions.length > 0 && (
          <div className="space-y-1.5">
            <Label>Sub-category *</Label>
            <Select value={form.sub_category} onValueChange={(v) => update("sub_category", v)}>
              <SelectTrigger><SelectValue placeholder="Select sub-category" /></SelectTrigger>
              <SelectContent>
                {subCategoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {isOther && (
          <div className="space-y-1.5">
            <Label>Specify category *</Label>
            <Input
              value={form.other_category_name}
              onChange={(e) => update("other_category_name", e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Country *</Label>
          <Select value={form.country} onValueChange={(v) => update("country", v)}>
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!hideState && (
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <Input
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://"
          />
        </div>
        {showAddress && (
          <div className="space-y-1.5 col-span-2">
            <Label>Address</Label>
            <Textarea
              rows={2}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Relationship Manager *</Label>
          <Select value={form.owner_id} onValueChange={(v) => update("owner_id", v)}>
            <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {assignable.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name} — {u.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Source</Label>
          <Select value={form.lead_source} onValueChange={(v) => update("lead_source", v)}>
            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.lead_source === "Referral" && (
          <div className="space-y-1.5">
            <Label>Referred by</Label>
            <Input value={form.referral_by} onChange={(e) => update("referral_by", e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={form.priority}
            onValueChange={(v) => update("priority", v as BusinessFormState["priority"])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Expected close date</Label>
          <Input
            type="date"
            value={form.expected_close_date}
            onChange={(e) => update("expected_close_date", e.target.value)}
          />
        </div>
        {showProbability && (
          <div className="space-y-1.5">
            <Label>Probability</Label>
            <Select
              value={form.probability}
              onValueChange={(v) => update("probability", v as BusinessFormState["probability"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROBABILITY_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Annual revenue</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={form.estimated_annual_revenue}
              onChange={(e) => update("estimated_annual_revenue", e.target.value)}
              placeholder="0"
            />
            <Select
              value={form.revenue_unit}
              onValueChange={(v) => update("revenue_unit", v as BusinessFormState["revenue_unit"])}
            >
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cr">Crores</SelectItem>
                <SelectItem value="lakh">Lakhs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>AUC</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={form.auc}
              onChange={(e) => update("auc", e.target.value)}
              placeholder="0"
            />
            <Select
              value={form.auc_unit}
              onValueChange={(v) => update("auc_unit", v as BusinessFormState["auc_unit"])}
            >
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cr">Crores</SelectItem>
                <SelectItem value="lakh">Lakhs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Internal remarks</Label>
          <Textarea rows={3} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} />
        </div>
      </section>

      <section className="space-y-2">
        <Label>Services required *</Label>
        <div className="grid grid-cols-2 gap-2">
          {SERVICES.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 rounded-md border p-2.5 text-sm cursor-pointer hover:bg-accent"
            >
              <Checkbox checked={form.services.includes(s)} onCheckedChange={() => toggleService(s)} />
              {s}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
