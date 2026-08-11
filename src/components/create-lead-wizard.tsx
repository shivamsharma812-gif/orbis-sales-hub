import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAssignableUsers } from "@/hooks/use-assignable-users";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PIPELINE_STAGES } from "@/components/stage-badge";
import { Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CLIENT_CATEGORIES = [
  "Alternative Investment Fund (AIF)",
  "Portfolio Management Services (PMS)",
  "Foreign Portfolio Investor (FPI)",
  "Foreign Direct Investment (FDI)",
  "Foreign Venture Capital Investor (FVCI)",
  "Trading Member",
  "Family Office",
  "General Corporate",
  "Individual",
  "Other",
] as const;

const PROBABILITY_VALUES: Record<string, number> = { high: 80, moderate: 50, low: 20 };
const PROBABILITY_LABELS: Record<string, string> = { high: "High", moderate: "Moderate", low: "Low" };

const SUB_CATEGORIES: Record<string, string[]> = {
  "Alternative Investment Fund (AIF)": ["Category I", "Category II", "Category III"],
  "Portfolio Management Services (PMS)": ["DPMS", "NDPMS"],
  "Foreign Portfolio Investor (FPI)": ["Category I", "Category II"],
};

const COUNTRIES = [
  "India",
  "GIFT City (India)",
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bermuda","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","British Virgin Islands","Brunei","Bulgaria","Burkina Faso","Burundi",
  "Cambodia","Cameroon","Canada","Cayman Islands","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Denmark","Djibouti","Dominica","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Estonia","Ethiopia",
  "Fiji","Finland","France",
  "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Guatemala","Guernsey","Guinea","Guyana",
  "Haiti","Honduras","Hong Kong","Hungary",
  "Iceland","Indonesia","Iran","Iraq","Ireland","Isle of Man","Israel","Italy","Ivory Coast",
  "Jamaica","Japan","Jersey","Jordan",
  "Kazakhstan","Kenya","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
  "Macau","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritania","Mauritius","Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
  "Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway",
  "Oman",
  "Pakistan","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Puerto Rico",
  "Qatar",
  "Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam",
  "Yemen",
  "Zambia","Zimbabwe",
  "Other",
];

const CATEGORIES_HIDE_STATE = new Set([
  "Foreign Portfolio Investor (FPI)",
  "Foreign Direct Investment (FDI)",
  "Foreign Venture Capital Investor (FVCI)",
]);

const LEAD_SOURCES = [
  "Referral",
  "Cold Outreach",
  "Event",
  "Website",
  "Regulatory Filing",
  "Partner",
  "Inbound Email",
];

const SERVICES = [
  "Custody & Allied Services",
  "PCM",
  "RTA",
  "Trusteeship",
  "Fund Accounting",
  "Fund Administration",
] as const;

function toCrores(value: string, unit: "cr" | "lakh"): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return unit === "lakh" ? n / 100 : n;
}

const STEPS = [
  { key: "basic", title: "Basic Information" },
  { key: "contact", title: "Primary Contact" },
  { key: "sales", title: "Sales Information" },
  { key: "services", title: "Services & Review" },
] as const;

interface FormState {
  // Step 1
  company_name: string;
  client_category: string;
  sub_category: string;
  other_category_name: string;
  country: string;
  state: string;
  city: string;
  website: string;
  // Step 2
  contact_name: string;
  contact_designation: string;
  contact_email: string;
  contact_phone: string;
  contact_linkedin: string;
  contact_is_primary_dm: boolean;
  // Step 3
  assigned_rm: string;
  lead_source: string;
  referral_by: string;
  pipeline_stage: string;
  priority: "low" | "medium" | "high";
  expected_close_date: string;
  estimated_annual_revenue: string;
  revenue_unit: "cr" | "lakh";
  auc: string;
  auc_unit: "cr" | "lakh";
  probability: "high" | "moderate" | "low";
  internal_remarks: string;
  // Step 4
  services: string[];
}

const initialState: FormState = {
  company_name: "",
  client_category: "",
  sub_category: "",
  other_category_name: "",
  country: "India",
  state: "",
  city: "",
  website: "",
  contact_name: "",
  contact_designation: "",
  contact_email: "",
  contact_phone: "",
  contact_linkedin: "",
  contact_is_primary_dm: true,
  assigned_rm: "",
  lead_source: "Referral",
  referral_by: "",
  pipeline_stage: "Prospect",
  priority: "medium",
  expected_close_date: "",
  estimated_annual_revenue: "",
  revenue_unit: "cr",
  auc: "",
  auc_unit: "cr",
  probability: "moderate",
  internal_remarks: "",
  services: [],
};

export function CreateLeadWizard({
  openOverride,
  onOpenChange,
  hideTrigger,
}: {
  openOverride?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
} = {}) {
  const [openState, setOpenState] = useState(false);
  const open = openOverride ?? openState;
  const setOpen = (o: boolean) => { setOpenState(o); onOpenChange?.(o); };
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: assignable = [] } = useAssignableUsers();

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({ ...initialState, assigned_rm: me?.id ?? "" });
    setStep(0);
  };

  // Prefill RM to self when dialog opens
  const handleOpen = (o: boolean) => {
    if (o) {
      setForm((f) => ({ ...f, assigned_rm: f.assigned_rm || me?.id || "" }));
    } else {
      reset();
    }
    setOpen(o);
  };

  const subCategoryOptions = SUB_CATEGORIES[form.client_category] ?? [];
  const needsSubCategory = subCategoryOptions.length > 0;
  const isOther = form.client_category === "Other";

  const stepErrors = useMemo(() => {
    const errs: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [] };
    if (!form.company_name.trim()) errs[0].push("Company name is required");
    if (!form.client_category) errs[0].push("Client category is required");
    if (needsSubCategory && !form.sub_category) errs[0].push("Sub-category is required");
    if (isOther && !form.other_category_name.trim())
      errs[0].push("Other category name is required");
    if (!form.country) errs[0].push("Country is required");

    if (!form.contact_name.trim()) errs[1].push("Contact name is required");
    if (!form.contact_email.trim() && !form.contact_phone.trim())
      errs[1].push("Provide at least an email or phone");
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email))
      errs[1].push("Contact email looks invalid");

    if (!form.assigned_rm) errs[2].push("Assign a Relationship Manager");
    if (!form.pipeline_stage) errs[2].push("Pipeline stage is required");

    if (form.services.length === 0) errs[3].push("Select at least one service");
    return errs;
  }, [form, needsSubCategory, isOther]);

  const currentErrors = stepErrors[step];
  const canProceed = currentErrors.length === 0;
  const allValid = Object.values(stepErrors).every((e) => e.length === 0);

  const create = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      const clientTypeLabel = isOther
        ? form.other_category_name.trim()
        : needsSubCategory
          ? `${form.client_category} — ${form.sub_category}`
          : form.client_category;

      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          company_name: form.company_name.trim(),
          client_type: clientTypeLabel,
          sub_category: needsSubCategory ? form.sub_category : null,
          country: form.country || null,
          state: form.state || null,
          city: form.city || null,
          website: form.website || null,
          lead_source: form.lead_source,
          referral_by: form.referral_by || null,
          pipeline_stage: form.pipeline_stage as never,
          priority: form.priority,
          expected_close_date: form.expected_close_date || null,
          estimated_annual_revenue: form.estimated_annual_revenue
            ? toCrores(form.estimated_annual_revenue, form.revenue_unit)
            : null,
          estimated_deal_value: form.estimated_annual_revenue
            ? toCrores(form.estimated_annual_revenue, form.revenue_unit)
            : 0,
          probability: PROBABILITY_VALUES[form.probability] ?? null,
          notes: form.internal_remarks || null,
          services: form.services,
          owner_id: form.assigned_rm,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: cErr } = await supabase.from("contacts").insert({
        parent_type: "lead",
        parent_id: lead.id,
        name: form.contact_name.trim(),
        designation: form.contact_designation || null,
        email: form.contact_email || null,
        phone: form.contact_phone || null,
        linkedin_url: form.contact_linkedin || null,
        is_primary: true,
        notes: form.contact_is_primary_dm ? "Primary decision maker" : null,
      });
      if (cErr) throw cErr;
      return lead;
    },
    onSuccess: () => {
      toast.success("Lead created");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      handleOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="w-4 h-4" /> New lead
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create new lead</DialogTitle>
          <DialogDescription>
            Capture everything needed to start working the opportunity.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-2 mt-1 mb-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s.key} className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full grid place-items-center text-xs font-semibold border shrink-0",
                    done && "bg-primary text-primary-foreground border-primary",
                    active && "bg-primary/10 text-primary border-primary",
                    !done && !active && "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-xs font-medium truncate",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-border ml-1" />
                )}
              </li>
            );
          })}
        </ol>

        <div className="min-h-[340px] max-h-[60vh] overflow-y-auto pr-1">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Company name *</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="e.g. Vertex Capital Advisors"
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {needsSubCategory && (
                <div className="space-y-1.5">
                  <Label>Sub-category *</Label>
                  <Select
                    value={form.sub_category}
                    onValueChange={(v) => update("sub_category", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-category" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategoryOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isOther && (
                <div className="space-y-1.5">
                  <Label>Other category name *</Label>
                  <Input
                    value={form.other_category_name}
                    onChange={(e) => update("other_category_name", e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Country *</Label>
                <Select value={form.country} onValueChange={(v) => update("country", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!CATEGORIES_HIDE_STATE.has(form.client_category) && (
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Website</Label>
                <Input
                  type="url"
                  placeholder="https://"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact name *</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => update("contact_name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Designation</Label>
                <Input
                  value={form.contact_designation}
                  onChange={(e) => update("contact_designation", e.target.value)}
                  placeholder="e.g. Chief Investment Officer"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => update("contact_email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => update("contact_phone", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>LinkedIn profile</Label>
                <Input
                  type="url"
                  placeholder="https://linkedin.com/in/…"
                  value={form.contact_linkedin}
                  onChange={(e) => update("contact_linkedin", e.target.value)}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between border border-border rounded-md px-3 py-2.5">
                <div>
                  <Label className="cursor-pointer">Primary decision maker</Label>
                  <div className="text-xs text-muted-foreground">
                    Mark if this contact has authority to sign the mandate.
                  </div>
                </div>
                <Switch
                  checked={form.contact_is_primary_dm}
                  onCheckedChange={(v) => update("contact_is_primary_dm", v)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assigned Relationship Manager *</Label>
                <Select
                  value={form.assigned_rm}
                  onValueChange={(v) => update("assigned_rm", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select RM" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                        {u.designation ? ` — ${u.designation}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Lead source</Label>
                <Select
                  value={form.lead_source}
                  onValueChange={(v) => update("lead_source", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Referral by</Label>
                <Input
                  value={form.referral_by}
                  onChange={(e) => update("referral_by", e.target.value)}
                  placeholder="Name of referrer / partner"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pipeline stage *</Label>
                <Select
                  value={form.pipeline_stage}
                  onValueChange={(v) => update("pipeline_stage", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => update("priority", v as FormState["priority"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
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
              <div className="space-y-1.5">
                <Label>AUC (Assets Under Custody)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.auc}
                    onChange={(e) => update("auc", e.target.value)}
                  />
                  <Select
                    value={form.auc_unit}
                    onValueChange={(v) => update("auc_unit", v as "cr" | "lakh")}
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cr">₹ Crores</SelectItem>
                      <SelectItem value="lakh">₹ Lakhs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.auc && (
                  <div className="text-[10px] text-muted-foreground">
                    = ₹{toCrores(form.auc, form.auc_unit).toFixed(2)} Cr
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Annual revenue</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.estimated_annual_revenue}
                    onChange={(e) => update("estimated_annual_revenue", e.target.value)}
                  />
                  <Select
                    value={form.revenue_unit}
                    onValueChange={(v) => update("revenue_unit", v as "cr" | "lakh")}
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cr">₹ Crores</SelectItem>
                      <SelectItem value="lakh">₹ Lakhs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.estimated_annual_revenue && (
                  <div className="text-[10px] text-muted-foreground">
                    = ₹{toCrores(form.estimated_annual_revenue, form.revenue_unit).toFixed(2)} Cr
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Probability</Label>
                <Select
                  value={form.probability}
                  onValueChange={(v) => update("probability", v as FormState["probability"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Internal remarks</Label>
                <Textarea
                  rows={3}
                  value={form.internal_remarks}
                  onChange={(e) => update("internal_remarks", e.target.value)}
                  placeholder="Context for the team — not shared with the client."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Services required *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICES.map((s) => {
                    const checked = form.services.includes(s);
                    return (
                      <label
                        key={s}
                        className={cn(
                          "flex items-center gap-2.5 border rounded-md px-3 py-2.5 cursor-pointer transition-colors",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            update(
                              "services",
                              v
                                ? [...form.services, s]
                                : form.services.filter((x) => x !== s),
                            );
                          }}
                        />
                        <span className="text-sm">{s}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border border-border rounded-md p-4 bg-surface-2/40">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Review
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <ReviewItem label="Company" value={form.company_name} />
                  <ReviewItem
                    label="Category"
                    value={
                      isOther
                        ? form.other_category_name
                        : [form.client_category, form.sub_category]
                            .filter(Boolean)
                            .join(" — ")
                    }
                  />
                  <ReviewItem
                    label="Location"
                    value={[form.city, form.state, form.country].filter(Boolean).join(", ")}
                  />
                  <ReviewItem label="Website" value={form.website} />
                  <ReviewItem label="Contact" value={form.contact_name} />
                  <ReviewItem
                    label="Contact info"
                    value={[form.contact_email, form.contact_phone]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <ReviewItem
                    label="Assigned RM"
                    value={
                      assignable.find((u) => u.id === form.assigned_rm)?.full_name ?? "—"
                    }
                  />
                  <ReviewItem label="Stage" value={form.pipeline_stage} />
                  <ReviewItem label="Priority" value={form.priority} />
                  <ReviewItem
                    label="Expected close"
                    value={form.expected_close_date || "—"}
                  />
                  <ReviewItem
                    label="Est. annual revenue"
                    value={
                      form.estimated_annual_revenue
                        ? `₹${toCrores(form.estimated_annual_revenue, form.revenue_unit).toFixed(2)} Cr`
                        : "—"
                    }
                  />
                  <ReviewItem
                    label="Probability"
                    value={PROBABILITY_LABELS[form.probability] ?? "—"}
                  />
                </dl>
              </div>
            </div>
          )}

          {currentErrors.length > 0 && (
            <ul className="mt-3 text-xs text-destructive space-y-0.5">
              {currentErrors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground self-center">
            Step {step + 1} of {STEPS.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => (step === 0 ? handleOpen(false) : setStep(step - 1))}
            >
              {step === 0 ? (
                "Cancel"
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4" /> Back
                </>
              )}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                disabled={!canProceed}
                onClick={() => setStep(step + 1)}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                disabled={!allValid || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? "Creating…" : "Create lead"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate">{value || "—"}</dd>
    </div>
  );
}
