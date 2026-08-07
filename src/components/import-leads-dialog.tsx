import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAssignableUsers } from "@/hooks/use-assignable-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

const PIPELINE_STAGES = [
  "Prospect", "Contacted", "Meeting Scheduled", "Meeting Completed",
  "Proposal Sent", "Negotiation", "Mandate Signed", "Onboarding", "Won", "Lost",
] as const;

const STAGE_SYNONYMS: Record<string, string> = {
  closed: "Won", close: "Won", won: "Won",
  lead: "Prospect", new: "Prospect", prospect: "Prospect",
  contacted: "Contacted", "reached out": "Contacted",
  meeting: "Meeting Scheduled", "meeting scheduled": "Meeting Scheduled",
  "meeting completed": "Meeting Completed", met: "Meeting Completed",
  proposal: "Proposal Sent", "proposal sent": "Proposal Sent",
  negotiating: "Negotiation", negotiation: "Negotiation",
  mandate: "Mandate Signed", "mandate signed": "Mandate Signed",
  onboarding: "Onboarding",
  lost: "Lost",
};

const SOURCE_SYNONYMS: Record<string, string> = {
  inbound: "Inbound Email", outbound: "Cold Outreach", referral: "Referral",
  event: "Event", website: "Website", regulatory: "Regulatory Filing", partner: "Partner",
};

const HEADER_ALIASES: Record<string, string> = {
  // Company name
  "company name": "company_name", company: "company_name", companyname: "company_name",
  client: "company_name", "client name": "company_name", account: "company_name",
  "account name": "company_name", organization: "company_name", organisation: "company_name",
  "business name": "company_name", customer: "company_name", name: "company_name",
  // Category
  category: "client_type", "client category": "client_type", "company category": "client_type",
  "client type": "client_type", clienttype: "client_type", industry: "client_type",
  sector: "client_type", type: "client_type", "account type": "client_type",
  // Sub-category
  "sub category": "sub_category", subcategory: "sub_category",
  "secondary category": "sub_category", "child category": "sub_category",
  // Owner
  owner: "owner", "owner name": "owner", "owner email": "owner", "deal owner": "owner",
  "account owner": "owner", assignee: "owner", "assigned to": "owner",
  "sales rep": "owner", rep: "owner", agent: "owner",
  // Stage
  stage: "pipeline_stage", "pipeline stage": "pipeline_stage", "deal stage": "pipeline_stage",
  status: "pipeline_stage", "lead status": "pipeline_stage", phase: "pipeline_stage",
  progress: "pipeline_stage",
  // Source
  source: "lead_source", "lead source": "lead_source", "deal source": "lead_source",
  origin: "lead_source", channel: "lead_source", "acquisition channel": "lead_source",
  // Estimated value
  "est value": "estimated_deal_value", "est. value": "estimated_deal_value",
  "estimated value": "estimated_deal_value", "estimated deal value": "estimated_deal_value",
  "deal value": "estimated_deal_value", "opportunity value": "estimated_deal_value",
  value: "estimated_deal_value", amount: "estimated_deal_value", revenue: "estimated_deal_value",
  // Created
  created: "created_at", "created date": "created_at", "created at": "created_at",
  date: "created_at", "entry date": "created_at", "addition date": "created_at",
  // Ignored
  actions: "actions", action: "actions", "is active": "actions", active: "actions",
};


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface ReportRow {
  row: number;
  company: string;
  status: "imported" | "updated" | "skipped";
  reason?: string;
}

export function ImportLeadsDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [mappedHeaders, setMappedHeaders] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: assignableUsers = [] } = useAssignableUsers();
  const { data: currentUser } = useCurrentUser();
  const qc = useQueryClient();

  const ownerLookup = useMemo(() => {
    const byName = new Map<string, string[]>();
    for (const u of assignableUsers) {
      const key = u.full_name.toLowerCase();
      byName.set(key, (byName.get(key) ?? []).concat(u.id));
    }
    return { byName };
  }, [assignableUsers]);

  const assignableIds = useMemo(() => new Set(assignableUsers.map((u) => u.id)), [assignableUsers]);

  function reset() {
    setFile(null);
    setReport(null);
    setMappedHeaders(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function normalizeHeader(h: string): string {
    return h.trim().toLowerCase().replace(/[\s_\-.]+/g, " ").trim();
  }

  function isJunkString(v: unknown): boolean {
    if (v === null || v === undefined) return true;
    const s = String(v).trim();
    if (s === "") return true;
    if (/^-?\d+(\.\d+)?$/.test(s)) return true;
    if (v instanceof Date) return true;
    return false;
  }

  function parseCurrency(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number" && isFinite(v)) return v;
    let s = String(v).trim().toLowerCase();
    s = s.replace(/[₹$,\s]/g, "");
    s = s.replace(/\bcr\b/g, "").replace(/\blakh(s)?\b/g, "").replace(/\bcrore(s)?\b/g, "");
    s = s.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function parseDate(v: unknown): string | null {
    if (v === null || v === undefined || v === "") return new Date().toISOString();
    if (v instanceof Date && isFinite(v.getTime())) return v.toISOString();
    if (typeof v === "number" && v > 25569 && v < 100000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (isFinite(d.getTime())) return d.toISOString();
    }
    const d = new Date(String(v));
    return isFinite(d.getTime()) ? d.toISOString() : null;
  }

  async function processFile() {
    if (!file) return;
    setProcessing(true);
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { toast.error("The workbook has no sheets."); setProcessing(false); return; }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
      if (rows.length === 0) { toast.error("The first sheet has no data rows."); setProcessing(false); return; }

      const rawHeaders = Object.keys(rows[0]);
      const mapping: Record<string, string> = {};
      for (const h of rawHeaders) mapping[h] = HEADER_ALIASES[normalizeHeader(h)] ?? "unknown";
      setMappedHeaders(rawHeaders.map((h) => `${h} → ${mapping[h]}`));

      const fields = Object.values(mapping);
      const missing: string[] = [];
      if (!fields.includes("company_name")) missing.push("Company Name");
      if (!fields.includes("client_type")) missing.push("Category");
      if (missing.length > 0) {
        toast.error(`Import Error: Missing required columns for ${missing.join(" / ")}. Please check your file headers.`);
        setProcessing(false);
        return;
      }
      const hasOwnerColumn = fields.includes("owner");
      if (!hasOwnerColumn && !currentUser) {
        toast.error("Could not determine a default owner. Add an Owner column and try again.");
        setProcessing(false);
        return;
      }


      // Email-based owner lookups
      const ownerEmails = new Set<string>();
      for (const r of rows) {
        const col = rawHeaders.find((h) => mapping[h] === "owner");
        if (col) {
          const val = String(r[col] ?? "").trim().toLowerCase();
          if (val.includes("@")) ownerEmails.add(val);
        }
      }
      const emailMap = new Map<string, string>();
      if (ownerEmails.size > 0) {
        const { data: emailUsers } = await supabase
          .from("users").select("id, email").in("email", [...ownerEmails]).eq("status", "active");
        for (const u of (emailUsers ?? []) as { id: string; email: string }[]) {
          if (u.email) emailMap.set(u.email.toLowerCase(), u.id);
        }
      }

      // Duplicate detection — fetch existing active leads matching company names
      const companyNames = new Set<string>();
      for (const r of rows) {
        const col = rawHeaders.find((h) => mapping[h] === "company_name");
        if (col) { const c = String(r[col] ?? "").trim(); if (c) companyNames.add(c); }
      }
      const existing = new Map<string, string>();
      const companyArr = [...companyNames];
      if (companyArr.length > 0) {
        const orFilter = companyArr.slice(0, 100).map((c) => `company_name.ilike.${c}`).join(",");
        const { data: matched } = await supabase
          .from("leads").select("id, company_name, client_type")
          .eq("status", "active").or(orFilter);
        for (const m of (matched ?? []) as { id: string; company_name: string; client_type: string | null }[]) {
          existing.set(`${m.company_name.trim().toLowerCase()}|${(m.client_type ?? "").trim().toLowerCase()}`, m.id);
        }
      }

      const toInsert: LeadInsert[] = [];
      const toUpdate: { id: string; patch: LeadUpdate }[] = [];
      const results: ReportRow[] = [];
      const seenInFile = new Set<string>();

      rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const getVal = (field: string): unknown => {
          const col = rawHeaders.find((h) => mapping[h] === field);
          return col ? r[col] : "";
        };

        const company = String(getVal("company_name") ?? "").trim();
        const category = String(getVal("client_type") ?? "").trim();
        const ownerRaw = getVal("owner");
        const notes: string[] = [];

        if (isJunkString(getVal("company_name")) || isJunkString(getVal("client_type"))) {
          results.push({ row: rowNum, company: company || "(empty)", status: "skipped", reason: "Company name or category is empty/invalid" });
          return;
        }

        // Owner — falls back to the signed-in user when the column is absent or blank
        let ownerId: string | null = null;
        if (!hasOwnerColumn || isJunkString(ownerRaw)) {
          ownerId = currentUser?.id ?? null;
          notes.push("Owner defaulted to you");
        } else {
          const ownerStr = String(ownerRaw).trim();
          if (ownerStr.includes("@")) {
            ownerId = emailMap.get(ownerStr.toLowerCase()) ?? null;
            if (!ownerId) {
              results.push({ row: rowNum, company, status: "skipped", reason: `No user with email "${ownerStr}"` });
              return;
            }
          } else {
            const matches = ownerLookup.byName.get(ownerStr.toLowerCase());
            if (!matches || matches.length === 0) {
              results.push({ row: rowNum, company, status: "skipped", reason: `No user named "${ownerStr}"` });
              return;
            }
            if (matches.length > 1) {
              results.push({ row: rowNum, company, status: "skipped", reason: `Multiple users named "${ownerStr}"` });
              return;
            }
            ownerId = matches[0];
          }
        }
        if (!ownerId || !assignableIds.has(ownerId)) {
          results.push({ row: rowNum, company, status: "skipped", reason: "Owner is outside your reporting team" });
          return;
        }

        // Stage — unrecognized values fall back to the default stage
        let stage = "Prospect";
        const stageRaw = getVal("pipeline_stage");
        if (stageRaw && String(stageRaw).trim()) {
          const raw = String(stageRaw).trim();
          const mapped = STAGE_SYNONYMS[raw.toLowerCase()];
          if (mapped) stage = mapped;
          else if ((PIPELINE_STAGES as readonly string[]).includes(raw)) stage = raw;
          else notes.push(`Unrecognized stage "${raw}" — set to Prospect`);
        }

        // Source — defaults to "Excel Import"
        let source = "Excel Import";
        const sourceRaw = getVal("lead_source");
        if (sourceRaw && String(sourceRaw).trim() && !isJunkString(sourceRaw)) {
          const raw = String(sourceRaw).trim();
          source = SOURCE_SYNONYMS[raw.toLowerCase()] ?? raw;
        }

        // Est. value — unparseable falls back to 0 with a warning
        let dealValue = 0;
        const valueRaw = getVal("estimated_deal_value");
        if (valueRaw !== "" && valueRaw !== null && valueRaw !== undefined) {
          const parsed = parseCurrency(valueRaw);
          if (parsed === null) notes.push(`Unparseable value "${valueRaw}" — set to 0`);
          else dealValue = parsed;
        }

        // Created — invalid falls back to now
        const createdRaw = getVal("created_at");
        let created = parseDate(createdRaw);
        if (!created) {
          created = new Date().toISOString();
          notes.push(`Invalid date "${createdRaw}" — set to today`);
        }

        const subCategoryRaw = getVal("sub_category");
        const subCategory = isJunkString(subCategoryRaw) ? null : String(subCategoryRaw).trim();

        const dupKey = `${company.toLowerCase()}|${category.toLowerCase()}`;
        if (seenInFile.has(dupKey)) {
          results.push({ row: rowNum, company, status: "skipped", reason: "Duplicate of an earlier row in this file" });
          return;
        }
        seenInFile.add(dupKey);
        const existingLeadId = existing.get(dupKey);

        const base: LeadUpdate = {
          company_name: company,
          client_type: category,
          owner_id: ownerId,
          pipeline_stage: stage as LeadUpdate["pipeline_stage"],
          estimated_deal_value: dealValue,
          lead_source: source,
          created_at: created,
        };
        if (subCategory) base.sub_category = subCategory;

        if (existingLeadId) {
          toUpdate.push({ id: existingLeadId, patch: base });
          results.push({ row: rowNum, company, status: "updated", reason: notes.join("; ") || undefined });
        } else {
          toInsert.push({
            ...base,
            status: "active",
            priority: "medium",
            services: [],
          } as LeadInsert);
          results.push({ row: rowNum, company, status: "imported", reason: notes.join("; ") || undefined });
        }
      });


      let insertedCount = 0;
      if (toInsert.length > 0) {
        const { error } = await supabase.from("leads").insert(toInsert);
        if (error) { toast.error(`Insert failed: ${error.message}`); setProcessing(false); return; }
        insertedCount = toInsert.length;
      }

      let updatedCount = 0;
      for (const u of toUpdate) {
        const { error } = await supabase.from("leads").update(u.patch).eq("id", u.id);
        if (!error) updatedCount++;
      }

      const skippedCount = results.filter((r) => r.status === "skipped").length;
      if (skippedCount === 0) {
        toast.success(`Successfully imported ${insertedCount} records${updatedCount ? `, updated ${updatedCount}` : ""}.`);
      } else {
        toast.warning(
          `Imported ${insertedCount} records${updatedCount ? `, updated ${updatedCount}` : ""}. Skipped ${skippedCount} rows due to data formatting issues or duplicate companies.`,
        );
      }
      setReport(results);
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setProcessing(false);
    }
  }

  const importedCount = report?.filter((r) => r.status === "imported").length ?? 0;
  const updatedCount = report?.filter((r) => r.status === "updated").length ?? 0;
  const skippedRows = report?.filter((r) => r.status === "skipped") ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Leads from Excel</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet (.xlsx, .xls, .csv). Columns are mapped by header name, so order
            doesn't matter. Required columns: Company Name, Category, Owner.
          </DialogDescription>
        </DialogHeader>

        {!report && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setReport(null);
                  setMappedHeaders(null);
                }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <UploadCloud className="w-8 h-8" />
                  <span className="text-sm">Click to select a file</span>
                </div>
              )}
            </div>

            {mappedHeaders && (
              <Alert>
                <AlertDescription className="text-xs">
                  <span className="font-medium">Detected columns:</span>{" "}
                  {mappedHeaders.join(" · ")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {report && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="w-4 h-4" /> {importedCount} imported
              </span>
              <span className="flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="w-4 h-4" /> {updatedCount} updated
              </span>
              {skippedRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="w-4 h-4" /> {skippedRows.length} skipped
                </span>
              )}
            </div>

            {skippedRows.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden">
                <div className="bg-surface-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Skipped rows
                </div>
                <div className="divide-y divide-border">
                  {skippedRows.map((r) => (
                    <div key={r.row} className="px-3 py-2 text-xs flex items-start gap-2">
                      <span className="text-muted-foreground font-mono w-8 shrink-0">R{r.row}</span>
                      <span className="font-medium shrink-0">{r.company}</span>
                      <span className="text-destructive">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skippedRows.length === 0 && (
              <p className="text-sm text-muted-foreground">All rows processed successfully.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {report ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={() => { reset(); }}>Import another file</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={processFile} disabled={!file || processing}>
                {processing ? "Processing…" : "Import"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
