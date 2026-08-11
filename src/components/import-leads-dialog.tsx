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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  firm: "company_name", "firm name": "company_name", "company firm": "company_name",
  prospect: "company_name", "prospect name": "company_name",
  "prospect client name": "company_name", "client prospect name": "company_name",
  "entity name": "company_name", "fund name": "company_name",
  // Category
  category: "client_type", "client category": "client_type", "company category": "client_type",
  "client type": "client_type", clienttype: "client_type", industry: "client_type",
  sector: "client_type", type: "client_type", "account type": "client_type",
  "business type": "client_type", "entity type": "client_type", "type of client": "client_type",
  // Sub-category
  "sub category": "sub_category", subcategory: "sub_category",
  "secondary category": "sub_category", "child category": "sub_category",
  // Owner
  owner: "owner", "owner name": "owner", "owner email": "owner", "deal owner": "owner",
  "account owner": "owner", assignee: "owner", "assigned to": "owner",
  "sales rep": "owner", rep: "owner", agent: "owner",
  rm: "owner", "rm name": "owner", "relationship manager": "owner",
  "relationship manager name": "owner", "rel manager": "owner", "rel manager name": "owner",
  "rm owner": "owner",

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
  "total revenue": "estimated_deal_value",
  "total revenue direct indirect": "estimated_deal_value",
  "expected revenue": "estimated_deal_value",
  "expected revenue direct": "revenue_direct",
  "expected revenue indirect": "revenue_indirect",
  "direct revenue": "revenue_direct", "indirect revenue": "revenue_indirect",
  // Annual revenue / AUM
  "estimated annual revenue": "estimated_annual_revenue",
  "annual revenue": "estimated_annual_revenue",
  "approx auc aum in inr crore": "auc_aum", "approx auc aum": "auc_aum",
  "auc aum": "auc_aum", auc: "auc_aum", aum: "auc_aum",
  "assets under custody": "auc_aum", "assets under management": "auc_aum",
  // Jurisdiction / geography
  jurisdiction: "city", city: "city", location: "city", "place": "city",
  state: "state", country: "country", region: "country",
  // Probability / heat
  probability: "probability", "probability of closure": "probability",
  "win probability": "probability", confidence: "probability",
  "heat map": "heat", heat: "heat", temperature: "heat", "heat map status": "heat",
  // Expected close
  "expected date for deal closure": "expected_close_date",
  "expected closure date": "expected_close_date",
  "expected close date": "expected_close_date",
  "expected date of closure": "expected_close_date",
  "closure date": "expected_close_date", "close date": "expected_close_date",
  "target close date": "expected_close_date",
  // Remarks / notes
  remarks: "notes", remark: "notes", notes: "notes", note: "notes",
  comments: "notes", comment: "notes", description: "notes",
  // Referral / website
  "referral by": "referral_by", "referred by": "referral_by", referral: "referral_by",
  website: "website", url: "website", "web site": "website",
  // Created
  created: "created_at", "created date": "created_at", "created at": "created_at",
  date: "created_at", "entry date": "created_at", "addition date": "created_at",
  // Ignored
  actions: "actions", action: "actions", "is active": "actions", active: "actions",
};

// Tick-mark style columns (e.g. "Services Engaged" sub-headers) → service names.
const SERVICE_COLUMNS: Record<string, string> = {
  trust: "Trusteeship", trusteeship: "Trusteeship",
  custo: "Custody & Allied Services", custody: "Custody & Allied Services",
  "custody allied services": "Custody & Allied Services",
  fa: "Fund Accounting", "fund accounting": "Fund Accounting",
  "fund administration": "Fund Administration",
  rt: "RTA", rta: "RTA", "registrar transfer agent": "RTA",
  pcm: "PCM",
};

const HEAT_TO_PRIORITY: Record<string, "high" | "medium" | "low"> = {
  hot: "high", warm: "medium", cold: "low",
  high: "high", medium: "medium", moderate: "medium", low: "low",
};

function isTicked(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  const s = String(v).trim().toLowerCase();
  if (!s || s === "-" || s === "0" || s === "no" || s === "n" || s === "false" || s === "na" || s === "n a") return false;
  return true;
}

function parsePercent(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && isFinite(v)) {
    // Excel percent cells arrive as fractions (0.4) unless typed as plain numbers.
    return Math.round(v <= 1 ? v * 100 : v);
  }
  const s = String(v).replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}



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
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
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
    setSheetNames([]);
    setSelectedSheet("");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Scan the workbook for sheet names when a file is picked so the user can
  // choose which sheet to import (single-sheet files are auto-selected).
  async function pickFile(f: File | null) {
    setFile(f);
    setReport(null);
    setMappedHeaders(null);
    setSheetNames([]);
    setSelectedSheet("");
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const names = wb.SheetNames ?? [];
      setSheetNames(names);
      setSelectedSheet(names[0] ?? "");
    } catch {
      setSheetNames([]);
    }
  }

  function normalizeHeader(h: string): string {
    return h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
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

  // Sheet dates carry no timezone — they are plain calendar days written in IST.
  // Store them at 12:00 IST (06:30 UTC) so the calendar day is identical whether
  // it's later read in IST or UTC.
  function isoFromParts(y: number, m: number, d: number): string | null {
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return new Date(Date.UTC(y, m - 1, d, 6, 30, 0)).toISOString();
  }

  function parseDate(v: unknown): string | null {
    if (v === null || v === undefined || v === "") return new Date().toISOString();

    // Excel serial number → calendar parts via SheetJS's own date codec (no timezone involved).
    if (typeof v === "number" && isFinite(v) && v > 0 && v < 100000) {
      const p = XLSX.SSF.parse_date_code(v);
      return p ? isoFromParts(p.y, p.m, p.d) : null;
    }

    // Defensive: if a Date object ever reaches here, read its UTC calendar parts.
    if (v instanceof Date && isFinite(v.getTime())) {
      return isoFromParts(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
    }

    const s = String(v).trim();
    if (!s) return null;

    // ISO-ish: YYYY-MM-DD or YYYY/MM/DD
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return isoFromParts(+m[1], +m[2], +m[3]);

    // Day-first: DD/MM/YYYY or DD-MM-YY (Excel exports in India are day-first).
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (m) {
      let day = +m[1];
      let month = +m[2];
      let year = +m[3];
      if (year < 100) year += year < 70 ? 2000 : 1900;
      if (day > 12 && month > 12) return null;
      if (day <= 12 && month > 12) [day, month] = [month, day];
      return isoFromParts(year, month, day);
    }

    // Textual dates ("12 Mar 2024", "Mar 12, 2024") — parsed as a plain calendar day.
    const d = new Date(`${s} 00:00:00Z`);
    if (isFinite(d.getTime())) {
      return isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    const d2 = new Date(s);
    if (!isFinite(d2.getTime())) return null;
    return isoFromParts(d2.getFullYear(), d2.getMonth() + 1, d2.getDate());
  }




  async function processFile() {
    if (!file) return;
    setProcessing(true);
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      // No cellDates: keep dates as raw Excel serials so no timezone conversion happens.
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = selectedSheet && wb.SheetNames.includes(selectedSheet)
        ? selectedSheet
        : wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) { toast.error("The workbook has no sheets."); setProcessing(false); return; }
      // Sheets often have a title row and/or a two-row header (e.g. "Services Engaged"
      // spanning Trust / Custo / FA / RT). Find the row that looks most like a header,
      // optionally merging it with the row below it.
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1, defval: "", raw: true, blankrows: false,
      });
      if (aoa.length === 0) { toast.error(`The sheet "${sheetName}" is empty.`); setProcessing(false); return; }

      const cellText = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
      const recognize = (h: string) => {
        const n = normalizeHeader(h);
        return !!n && (!!HEADER_ALIASES[n] || !!SERVICE_COLUMNS[n]);
      };
      const scoreOf = (hs: string[]) => hs.filter(recognize).length;

      let headerIdx = 0;
      let headerRows = 1;
      let bestScore = -1;
      const limit = Math.min(aoa.length, 12);
      for (let i = 0; i < limit; i++) {
        const main = (aoa[i] ?? []).map(cellText);
        const next = (aoa[i + 1] ?? []).map(cellText);
        const merged = main.map((m, c) => next[c] || m);
        const s1 = scoreOf(main);
        const s2 = aoa[i + 1] ? scoreOf(merged) : -1;
        if (s1 > bestScore) { bestScore = s1; headerIdx = i; headerRows = 1; }
        if (s2 > bestScore) { bestScore = s2; headerIdx = i; headerRows = 2; }
      }

      const mainRow = (aoa[headerIdx] ?? []).map(cellText);
      const subRow = (aoa[headerIdx + 1] ?? []).map(cellText);
      const width = Math.max(mainRow.length, headerRows === 2 ? subRow.length : 0);
      const headerCells: string[] = [];
      for (let c = 0; c < width; c++) {
        const main = mainRow[c] ?? "";
        const sub = headerRows === 2 ? (subRow[c] ?? "") : "";
        headerCells.push((sub || main || `Column ${c + 1}`).replace(/\s+/g, " ").trim());
      }
      // Ensure unique keys
      const seenHeader = new Map<string, number>();
      const rawHeaders = headerCells.map((h) => {
        const count = (seenHeader.get(h) ?? 0) + 1;
        seenHeader.set(h, count);
        return count === 1 ? h : `${h} (${count})`;
      });

      const rows: Record<string, unknown>[] = [];
      for (let i = headerIdx + headerRows; i < aoa.length; i++) {
        const arr = aoa[i] ?? [];
        const obj: Record<string, unknown> = {};
        rawHeaders.forEach((h, c) => { obj[h] = arr[c] ?? ""; });
        if (rawHeaders.some((h) => cellText(obj[h]) !== "")) rows.push(obj);
      }
      if (rows.length === 0) { toast.error(`The sheet "${sheetName}" has no data rows.`); setProcessing(false); return; }

      const mapping: Record<string, string> = {};
      for (const h of rawHeaders) {
        const n = normalizeHeader(h);
        mapping[h] = HEADER_ALIASES[n] ?? (SERVICE_COLUMNS[n] ? `service:${SERVICE_COLUMNS[n]}` : "unknown");
      }
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

        // Currency columns are normalised to crores, using the unit hinted in the header
        // ("in INR crore", "lakh") and falling back to a rupee-magnitude heuristic.
        const colFor = (field: string) => rawHeaders.find((h) => mapping[h] === field);
        const toCrores = (field: string): number | null => {
          const raw = getVal(field);
          if (raw === "" || raw === null || raw === undefined) return null;
          const parsed = parseCurrency(raw);
          if (parsed === null) { notes.push(`Unparseable value "${raw}" — ignored`); return null; }
          const header = normalizeHeader(colFor(field) ?? "");
          const cellText = String(raw).toLowerCase();
          if (/\bcr\b|crore/.test(header) || /\bcr\b|crore/.test(cellText)) return parsed;
          if (/lakh|lac/.test(header) || /lakh|lac/.test(cellText)) return parsed / 100;
          if (Math.abs(parsed) >= 100000) {
            notes.push(`"${raw}" read as rupees → ${(parsed / 1e7).toFixed(2)} Cr`);
            return parsed / 1e7;
          }
          return parsed;
        };

        // Est. value — total revenue, or direct + indirect when only those are present
        let dealValue = toCrores("estimated_deal_value");
        if (dealValue === null) {
          const direct = toCrores("revenue_direct");
          const indirect = toCrores("revenue_indirect");
          if (direct !== null || indirect !== null) dealValue = (direct ?? 0) + (indirect ?? 0);
        }
        if (dealValue === null) dealValue = 0;

        // Created — invalid falls back to now
        const createdRaw = getVal("created_at");
        let created = parseDate(createdRaw);
        if (!created) {
          created = new Date().toISOString();
          notes.push(`Invalid date "${createdRaw}" — set to today`);
        }

        const text = (field: string): string | null => {
          const v = getVal(field);
          if (v === null || v === undefined) return null;
          const s = String(v).trim();
          return s && s !== "-" ? s : null;
        };

        const subCategory = isJunkString(getVal("sub_category")) ? null : String(getVal("sub_category")).trim();

        // Services engaged — tick-mark columns
        const services: string[] = [];
        for (const h of rawHeaders) {
          const field = mapping[h];
          if (field.startsWith("service:") && isTicked(r[h])) {
            const svc = field.slice("service:".length);
            if (!services.includes(svc)) services.push(svc);
          }
        }

        const probability = parsePercent(getVal("probability"));
        const heat = text("heat");
        const priority = (heat && HEAT_TO_PRIORITY[heat.toLowerCase()]) ?? "medium";
        const closeIso = parseDate(getVal("expected_close_date"));
        const expectedClose = getVal("expected_close_date") === "" ? null : closeIso ? closeIso.slice(0, 10) : null;
        const annualRevenue = toCrores("estimated_annual_revenue");
        const aucAum = toCrores("auc_aum");

        const noteParts: string[] = [];
        const remarks = text("notes");
        if (remarks) noteParts.push(remarks);
        if (aucAum !== null) noteParts.push(`Approx AUC/AUM: ₹${aucAum} Cr`);
        if (heat) noteParts.push(`Heat map: ${heat}`);

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
          priority: priority as LeadUpdate["priority"],
        };
        if (subCategory) base.sub_category = subCategory;
        if (services.length > 0) base.services = services;
        if (probability !== null) base.probability = probability;
        if (expectedClose) base.expected_close_date = expectedClose;
        if (annualRevenue !== null) base.estimated_annual_revenue = annualRevenue;
        if (aucAum !== null) base.auc = aucAum;
        if (noteParts.length > 0) base.notes = noteParts.join("\n");
        const city = text("city");
        if (city) base.city = city;
        const state = text("state");
        if (state) base.state = state;
        const country = text("country");
        if (country) base.country = country;
        const website = text("website");
        if (website) base.website = website;
        const referral = text("referral_by");
        if (referral) base.referral_by = referral;

        if (existingLeadId) {
          toUpdate.push({ id: existingLeadId, patch: base });
          results.push({ row: rowNum, company, status: "updated", reason: notes.join("; ") || undefined });
        } else {
          toInsert.push({
            ...base,
            status: "active",
            services: services,
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
  const warningRows = report?.filter((r) => r.status !== "skipped" && r.reason) ?? [];

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
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
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

            {file && sheetNames.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Sheet to import</label>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheetNames.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This workbook has {sheetNames.length} sheets. Choose the one with your lead data.
                </p>
              </div>
            )}

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

            {warningRows.length > 0 && (
              <div className="border border-border rounded-md overflow-hidden">
                <div className="bg-surface-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Imported with adjustments
                </div>
                <div className="divide-y divide-border">
                  {warningRows.map((r) => (
                    <div key={`w-${r.row}`} className="px-3 py-2 text-xs flex items-start gap-2">
                      <span className="text-muted-foreground font-mono w-8 shrink-0">R{r.row}</span>
                      <span className="font-medium shrink-0">{r.company}</span>
                      <span className="text-warning">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skippedRows.length === 0 && warningRows.length === 0 && (
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
