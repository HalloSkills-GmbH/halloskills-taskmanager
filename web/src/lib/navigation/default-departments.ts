/** Feste Abteilungs-Slugs und Anzeigenamen (Sidebar-Reihenfolge). DB-Zeilen sollten per Migration 006 existieren. */
export const DEFAULT_DEPARTMENT_SLUGS_ORDER = [
  "marketing",
  "sales",
  "customer-success",
  "produkt",
  "zertifizierung",
  "it",
] as const;

export const DEFAULT_DEPARTMENT_LABELS: Record<string, string> = {
  marketing: "Marketing",
  sales: "Sales",
  "customer-success": "Customer Success",
  produkt: "Produkt",
  zertifizierung: "Zertifizierung",
  it: "IT",
};

export type DefaultDeptSlug = (typeof DEFAULT_DEPARTMENT_SLUGS_ORDER)[number];
