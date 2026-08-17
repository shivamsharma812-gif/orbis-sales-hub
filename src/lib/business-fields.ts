/**
 * Single source of truth for the business fields captured when creating or
 * editing a pipeline lead and a client. Both forms build on this so they can
 * never drift apart. `status` is deliberately NOT part of this contract:
 * leads manage it through their own controls and new clients are always
 * stored as "onboarded" (enforced by the database).
 */

export const CLIENT_CATEGORIES = [
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

export const PROBABILITY_VALUES: Record<string, number> = { high: 80, moderate: 50, low: 20 };
export const PROBABILITY_LABELS: Record<string, string> = { high: "High", moderate: "Moderate", low: "Low" };

export function probabilityKey(value: number | null | undefined): "high" | "moderate" | "low" {
  if (value == null) return "moderate";
  if (value >= 70) return "high";
  if (value >= 40) return "moderate";
  return "low";
}

export const SUB_CATEGORIES: Record<string, string[]> = {
  "Alternative Investment Fund (AIF)": ["Category I", "Category II", "Category III"],
  "Portfolio Management Services (PMS)": ["DPMS", "NDPMS"],
  "Foreign Portfolio Investor (FPI)": ["Category I", "Category II"],
};

export const COUNTRIES = [
  "India",
  "GIFT City (India)",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bermuda",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "British Virgin Islands",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cayman Islands",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Guernsey",
  "Guinea",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "Indonesia",
  "Iraq",
  "Ireland",
  "Isle of Man",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jersey",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macau",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Puerto Rico",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Somalia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
  "Other",
];

export const CATEGORIES_HIDE_STATE = new Set([
  "Foreign Portfolio Investor (FPI)",
  "Foreign Direct Investment (FDI)",
  "Foreign Venture Capital Investor (FVCI)",
]);

export const LEAD_SOURCES = [
  "Referral",
  "Cold Outreach",
  "Event",
  "Website",
  "Regulatory Filing",
  "Partner",
  "Inbound Email",
];

export const SERVICES = [
  "Custody & Allied Services",
  "PCM",
  "RTA",
  "Trusteeship",
  "Fund Accounting",
  "Fund Administration",
] as const;

export type MoneyUnit = "cr" | "lakh";

export function toCrores(value: string, unit: MoneyUnit): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return unit === "lakh" ? n / 100 : n;
}

export interface BusinessFormState {
  company_name: string;
  client_category: string;
  sub_category: string;
  other_category_name: string;
  country: string;
  state: string;
  city: string;
  website: string;
  address: string;
  lead_source: string;
  referral_by: string;
  priority: "low" | "medium" | "high";
  expected_close_date: string;
  estimated_annual_revenue: string;
  revenue_unit: MoneyUnit;
  auc: string;
  auc_unit: MoneyUnit;
  probability: "high" | "moderate" | "low";
  remarks: string;
  services: string[];
  owner_id: string;
}

export const emptyBusinessForm: BusinessFormState = {
  company_name: "",
  client_category: "",
  sub_category: "",
  other_category_name: "",
  country: "India",
  state: "",
  city: "",
  website: "",
  address: "",
  lead_source: "Referral",
  referral_by: "",
  priority: "medium",
  expected_close_date: "",
  estimated_annual_revenue: "",
  revenue_unit: "cr",
  auc: "",
  auc_unit: "cr",
  probability: "moderate",
  remarks: "",
  services: [],
  owner_id: "",
};

/** Shared validation used by lead create/edit and client create/edit. */
export function validateBusinessForm(f: BusinessFormState, opts?: { showState?: boolean }): string[] {
  const errs: string[] = [];
  const needsSub = (SUB_CATEGORIES[f.client_category] ?? []).length > 0;
  const stateVisible = (opts?.showState ?? true) && !CATEGORIES_HIDE_STATE.has(f.client_category);
  if (!f.company_name.trim()) errs.push("Company name is required");
  if (!f.client_category) errs.push("Client category is required");
  if (needsSub && !f.sub_category) errs.push("Sub-category is required");
  if (f.client_category === "Other" && !f.other_category_name.trim()) errs.push("Other category name is required");
  if (!f.country) errs.push("Country is required");
  if (stateVisible && !(f.state ?? "").trim()) errs.push("State is required");

  if (!(f.city ?? "").trim()) errs.push("City is required");
  if (!f.owner_id) errs.push("Assign a Relationship Manager");

  if (f.services.length === 0) errs.push("Select at least one service");
  return errs;
}

export function clientTypeLabel(f: BusinessFormState): string {
  const needsSub = (SUB_CATEGORIES[f.client_category] ?? []).length > 0;
  if (f.client_category === "Other") return f.other_category_name.trim();
  return needsSub ? `${f.client_category} — ${f.sub_category}` : f.client_category;
}

function revenueCr(f: BusinessFormState): number | null {
  return f.estimated_annual_revenue ? toCrores(f.estimated_annual_revenue, f.revenue_unit) : null;
}

/** Columns for the `leads` table (create and edit). */
export function businessToLeadColumns(f: BusinessFormState) {
  const needsSub = (SUB_CATEGORIES[f.client_category] ?? []).length > 0;
  const rev = revenueCr(f);
  return {
    company_name: f.company_name.trim(),
    client_type: clientTypeLabel(f),
    sub_category: needsSub ? f.sub_category : null,
    country: f.country || null,
    state: f.state || null,
    city: f.city || null,
    website: f.website || null,
    lead_source: f.lead_source || null,
    referral_by: f.referral_by || null,
    priority: f.priority,
    expected_close_date: f.expected_close_date || null,
    estimated_annual_revenue: rev,
    estimated_deal_value: rev ?? 0,
    auc: f.auc ? toCrores(f.auc, f.auc_unit) : 0,
    probability: PROBABILITY_VALUES[f.probability] ?? null,
    notes: f.remarks || null,
    services: f.services,
    owner_id: f.owner_id,
  };
}

/** Columns for the `clients` table (create and edit) — status is never included. */
export function businessToClientColumns(f: BusinessFormState) {
  const needsSub = (SUB_CATEGORIES[f.client_category] ?? []).length > 0;
  return {
    company_name: f.company_name.trim(),
    client_type: clientTypeLabel(f),
    sub_category: needsSub ? f.sub_category : null,
    country: f.country || null,
    city: f.city || null,
    website: f.website || null,
    address: f.address || null,
    lead_source: f.lead_source || null,
    referral_by: f.referral_by || null,
    priority: f.priority,
    expected_close_date: f.expected_close_date || null,
    annual_revenue: revenueCr(f) ?? 0,
    auc: f.auc ? toCrores(f.auc, f.auc_unit) : 0,
    remarks: f.remarks || null,
    services: f.services,
    service_type: f.services[0] ?? null,
    owner_id: f.owner_id,
  };
}

type AnyRow = Record<string, unknown>;

function splitCategory(clientType: string | null, subCategory: string | null) {
  const raw = clientType ?? "";
  const known = (CLIENT_CATEGORIES as readonly string[]).find((c) => raw === c || raw.startsWith(`${c} —`));
  if (known) return { client_category: known, sub_category: subCategory ?? "", other_category_name: "" };
  return { client_category: raw ? "Other" : "", sub_category: subCategory ?? "", other_category_name: raw };
}

export function rowToBusinessForm(row: AnyRow, kind: "lead" | "client"): BusinessFormState {
  const cat = splitCategory((row["client_type"] as string) ?? null, (row["sub_category"] as string) ?? null);
  const revenue =
    kind === "lead" ? (row["estimated_annual_revenue"] ?? row["estimated_deal_value"]) : row["annual_revenue"];
  return {
    ...emptyBusinessForm,
    ...cat,
    company_name: (row["company_name"] as string) ?? "",
    country: (row["country"] as string) ?? "",
    state: (row["state"] as string) ?? "",
    city: (row["city"] as string) ?? "",
    website: (row["website"] as string) ?? "",
    address: (row["address"] as string) ?? "",
    lead_source: (row["lead_source"] as string) ?? "",
    referral_by: (row["referral_by"] as string) ?? "",
    priority: ((row["priority"] as string) ?? "medium") as BusinessFormState["priority"],
    expected_close_date: (row["expected_close_date"] as string) ?? "",
    estimated_annual_revenue: revenue != null ? String(revenue) : "",
    revenue_unit: "cr",
    auc: row["auc"] != null ? String(row["auc"]) : "",
    auc_unit: "cr",
    probability: kind === "lead" ? probabilityKey(row["probability"] as number | null) : "moderate",
    remarks: ((kind === "lead" ? row["notes"] : row["remarks"]) as string) ?? "",
    services: ((row["services"] as string[]) ?? []).slice(),
    owner_id: (row["owner_id"] as string) ?? "",
  };
}
