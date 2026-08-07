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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAssignableUsers } from "@/hooks/use-assignable-users";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const PIPELINE_STAGES = [
  "Prospect",
  "Contacted",
  "Meeting Scheduled",
  "Meeting Completed",
  "Proposal Sent",
  "Negotiation",
  "Mandate Signed",
  "Onboarding",
  "Won",
  "Lost",
] as const;

const STAGE_SYNONYMS: Record<string, string> = {
  closed: "Won",
  close: "Won",
  won: "Won",
  lead: "Prospect",
  new: "Prospect",
  prospect: "Prospect",
  contacted: "Contacted",
  "reached out": "Contacted",
  meeting: "Meeting Scheduled",
  "meeting scheduled": "Meeting Scheduled",
  "meeting completed": "Meeting Completed",
  "met": "Meeting Completed",
  proposal: "Proposal Sent",
  "proposal sent": "Proposal Sent",
  negotiating: "Negotiation",
  negotiation: "Negotiation",
  mandate: "Mandate Signed",
  "mandate signed": "Mandate Signed",
  onboarding: "Onboarding",
  lost: "Lost",
};

const SOURCE_SYNONYMS: Record<string, string> = {
  inbound: "Inbound Email",
  outbound: "Cold Outreach",
  referral: "Referral",
  event: "Event",
  website: "Website",
  regulatory: "Regulatory Filing",
  partner: "Partner",
};

const HEADER_ALIASES: Record<string, string> = {
  "company name": "company_name",
  company: "company_name",
  companyname: "company_name",
  company_name: "company_name",
  category: "client_type",
  "client type": "client_type",
  client_type: "client_type",
  clienttype: "client_type",
  owner: "owner",
  "owner name": "owner",
  "owner email": "owner",
  "assigned to": "owner",
  stage: "pipeline_stage",
  "pipeline stage": "pipeline_stage",
  pipeline_stage: "pipeline_stage",
  status: "pipeline_stage",
  source: "lead_source",
  "lead source": "lead_source",
  lead_source: "lead_source",
  "est. value": "estimated_deal_value",
  "estimated value": "estimated_deal_value",
  "deal value": "estimated_deal_value",
  estimated_deal_value: "estimated_deal_value",
  value: "estimated_deal_value",
  created: "created_at",
  "created date": "created_at",
  created_at: "created_at",
  actions: "actions",
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
  const qc = useQueryClient();

  // Build lookup maps for owner resolution (email-first, then name)
  const ownerLookup = useMemo(() => {
    const byEmail = new Map<string, string>();
    const byName = new Map<string, string[]>();
    for (const u of assignableUsers) {
      const key = u.id;
      byName.set(u.full_name.toLowerCase(), (byName.get(u.full_name.toLowerCase()) ?? []).concat(key));
    }
    // Fetch email via users table select — assignable users don't carry email
    return { byName, byEmail };
  }, [assignableUsers]);

  const assignableIds = useMemo(() => new Set(assignableUsers.map((u) => u.id)), [assignableUsers]);

  function reset() {
    setFile(null);
    setReport(null);
    setMappedHeaders(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function normalizeHeader(h: string): string {
    return h.trim().toLowerCase().replace(/[\s_]+/g, " ").replace(/^[\s_]+|[\s_]+$/g, "");
  }

  function isJunkString(v: unknown): boolean {
    if (v === null || v === undefined) return true;
    const s = String(v).trim();
    if (s === "") return true;
    // pure number or date serial → junk for a name field
    if (/^-?\d+(\.\d+)?$/.test(s)) return true;
    if (v instanceof Date) return true;
    return false;
  }

  function parseCurrency(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number" && isFinite(v)) return v;
    let s = String(v).trim().toLowerCase();
    // strip currency symbols and units
    s = s.replace(/[₹$,\s]/g, "");
    s = s.replace(/\bcr\b/g, "");
    s = s.replace(/\blakh(s)?\b/g, "");
    s = s.replace(/\bcrore(s)?\b/g, "");
    s = s.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function parseDate(v: unknown): string | null {
    if (v === null || v === undefined || v === "") return new Date().toISOString();
    if (v instanceof Date && isFinite(v.getTime())) return v.toISOString();
    // Excel serial number
    if (typeof v === "number" && v > 25569 && v < 100000) {
      const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
      if (d && isFinite(d.getTime())) return d.toISOString();
    }
    const d = new Date(String(v));
    if (isFinite(d.getTime())) return d.toISOString();
    return null;
  }

  function resolveOwner(raw: unknown): { id: string } | { error: string } {
    const s = String(raw ?? "").trim();
    if (!s) return { error: "Owner is empty" };
    const lower = s.toLowerCase();
    // email-first: does it look like an email?
    if (/@/.test(lower)) {
      // We need emails — fetch via a separate lookup. For now match against
      // assignable users by fetching the users table with email. Since
      // assignableUsers doesn't carry email, we do a quick fetch.
      // But to keep this synchronous, we resolve email in the async path.
      return { error: "EMAIL_LOOKUP" };
    }
    const matches = ownerLookup.byName.get(lower);
    if (!matches || matches.length === 0) return { error: `No user named "${s}"` };
    if (matches.length > 1) return { error: `Multiple users named "${s}"` };
    return { id: matches[0] };
  }

  async function processFile() {
    if (!file) return;
    setProcessing(true);
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        toast.error("The workbook has no sheets.");
        setProcessing(false);
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
      if (rows.length === 0) {
        toast.error("The first sheet has no data rows.");
        setProcessing(false);
        return;
      }

      // map headers
      const rawHeaders = Object.keys(rows[0]);
      const mapping: Record<string, string> = {};
      for (const h of rawHeaders) {
        const norm = normalizeHeader(h);
        mapping[h] = HEADER_ALIASES[norm] ?? "unknown";
      }
      const mapped = rawHeaders.map((h) => `${h} → ${mapping[h]}`);
      setMappedHeaders(mapped);

      // mandatory headers check
      const fields = Object.values(mapping);
      const missing: string[] = [];
      if (!fields.includes("company_name")) missing.push("Company Name");
      if (!fields.includes("client_type")) missing.push("Category");
      if (!fields.includes("owner")) missing.push("Owner");
      if (missing.length > 0) {
        toast.error(`Missing required columns: ${missing.join(", ")}`);
        setProcessing(false);
        return;
      }

      // Pre-fetch users with email for email-based owner resolution
      const ownerValues = new Set<string>();
      for (const r of rows) {
        const col = rawHeaders.find((h) => mapping[h] === "owner");
        if (col) ownerValues.add(String(r[col] ?? "").trim().toLowerCase());
      }
      const emailLookups = [...ownerValues].filter((v) => v.includes("@"));
      const emailMap = new Map<string, string>();
      if (emailLookups.length > 0) {
        const { data: emailUsers } = await supabase
          .from("users")
          .select("id, email")
          .in("email", emailLookups)
          .eq("status", "active");
        for (const u of (emailUsers ?? []) as { id: string; email: string }[]) {
          if (u.email) emailMap.set(u.email.toLowerCase(), u.id);
        }
      }

      // dedupe detection: fetch existing active leads matching company names
      const companyNames = new Set<string>();
      for (const r of rows) {
        const col = rawHeaders.find((h) => mapping[h] === "company_name");
        if (col) companyNames.add(String(r[col] ?? "").trim());
      }
      const existing = new Map<string, { id: string; client_type: string | null }>();
      if (companyNames.size > 0) {
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("id, company_name, client_type")
          .eq("status", "active")
          .ilike("company_name", "")
          .in("company_name", [...companyNames].slice(0, 50));
        // ilike won't work with .in; do a direct fetch of active leads and filter in memory
      }
      // Simpler: fetch all active leads whose company_name is in our set via OR ilikes
      const companyArr = [...companyNames].filter(Boolean);
      if (companyArr.length > 0) {
        const orFilter = companyArr.map((c) => `company_name.ilike.${c}`).join(",");
        const { data: matched } = await supabase
          .from("leads")
          .select("id, company_name, client_type")
          .eq("status", "active")
          .or(orFilter);
        for (const m of (matched ?? []) as { id: string; company_name: string; client_type: string | null }[]) {
          existing.set(`${m.company_name.trim().toLowerCase()}|${(m.client_type ?? "").trim().toLowerCase()}`, {
            id: m.id,
            client_type: m.client_type,
          });
        }
      }

      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];
      const skipped: ReportRow[] = [];
      const results: ReportRow[] = [];
      const seenInFile = new Set<string>();

      rows.forEach((r, idx) => {
        const rowNum = idx + 2; // header is row 1
        const getVal = (field: string): unknown => {
          const col = rawHeaders.find((h) => mapping[h] === field);
          return col ? r[col] : "";
        };

        const companyRaw = getVal("company_name");
        const categoryRaw = getVal("client_type");
        const ownerRaw = getVal("owner");
        const stageRaw = getVal("pipeline_stage");
        const sourceRaw = getVal("lead_source");
        const valueRaw = getVal("estimated_deal_value");
        const createdRaw = getVal("created_at");

        const company = String(companyRaw ?? "").trim();
        const category = String(categoryRaw ?? "").trim();

        if (isJunkString(companyRaw) || isJunkString(categoryRaw)) {
          results.push({ row: rowNum, company: company || "(empty)", status: "skipped", reason: "Company name or category is empty/invalid" });
          return;
        }
        if (isJunkString(ownerRaw)) {
          results.push({ row: rowNum, company, status: "skipped", reason: "Owner is empty/invalid" });
          return;
        }

        // owner resolution
        const ownerStr = String(ownerRaw).trim();
        let ownerId: string | null = null;
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

        if (!ownerId || !assignableIds.has(ownerId)) {
          results.push({ row: rowNum, company, status: "skipped", reason: "Owner is outside your reporting team" });
          return;
        }

        // stage normalization
        let stage = "Prospect";
        if (stageRaw && String(stageRaw).trim()) {
          const stageNorm = String(stageRaw).trim().toLowerCase();
          const mapped = STAGE_SYNONYMS[stageNorm];
          if (!mapped && (PIPELINE_STAGES as readonly string[]).includes(String(stageRaw).trim())) {
            stage = String(stageRaw).trim();
          } else if (mapped) {
            stage = mapped;
          } else {
            results.push({ row: rowNum, company, status: "skipped", reason: `Unrecognized stage "${stageRaw}"` });
            return;
          }
        }

        // source normalization
        let source: string | null = null;
        if (sourceRaw && String(sourceRaw).trim()) {
          const sourceNorm = String(sourceRaw).trim().toLowerCase();
          source = SOURCE_SYNONYMS[sourceNorm] ?? String(sourceRaw).trim();
        }

        // value
        let dealValue = 0;
        if (valueRaw !== "" && valueRaw !== null && valueRaw !== undefined) {
          const parsed = parseCurrency(valueRaw);
          if (parsed === null) {
            results.push({ row: rowNum, company, status: "skipped", reason: `Invalid deal value "${valueRaw}"` });
            return;
          }
          dealValue = parsed;
        }

        // created
        const created = parseDate(createdRaw);

        const dupKey = `${company.toLowerCase()}|${category.toLowerCase()}`;
        const existingLead = existing.get(dupKey) ?? (seenInFile.has(dupKey) ? undefined : undefined);
        seenInFile.add(dupKey);

        const patch: Record<string, unknown> = {
          company_name: company,
          client_type: category,
          owner_id: ownerId,
          pipeline_stage: stage,
          estimated_deal_value: dealValue,
        };
        if (source !== null) patch.lead_source = source;
        if (created) patch.created_at = created;

        if (existingLead) {
          toUpdate.push({ id: existingLead.id, patch });
          results.push({ row: rowNum, company, status: "updated" });
        } else {
          toInsert.push({ ...patch, status: "active", priority: "medium", services: [] });
          results.push({ row: rowNum, company, status: "imported" });
        }
      });

      // Execute inserts
      let insertedCount = 0;
      if (toInsert.length > 0) {
        const { error } = await supabase.from("leads").insert(toInsert);
        if (error) {
          toast.error(`Insert failed: ${error.message}`);
          setProcessing(false);
          return;
        }
        insertedCount = toInsert.length;
      }

      // Execute updates
      let updatedCount = 0;
      for (const u of toUpdate) {
        const { error } = await supabase.from("leads").update(u.patch).eq("id", u.id);
        if (!error) updatedCount++;
      }

      const skippedCount = results.filter((r) => r.status === "skipped").length;
      toast.success(`Imported ${insertedCount}, updated ${updatedCount}, skipped ${skippedCount} row(s).`);
      setReport(results);
      qc.invalidateQueries({ queryKey: ["leads"] });
      if (skippedCount === 0 && toInsert.length > 0) setFile(null);
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
