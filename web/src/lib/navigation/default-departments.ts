/** Feste Abteilungs-Slugs und Anzeigenamen (Sidebar-Reihenfolge). */
export const DEFAULT_DEPARTMENT_SLUGS_ORDER = [
  "finanzen",
  "it",
  "marketing",
  "operations",
  "produkt",
  "sales",
  "zertifizierung",
] as const;

export const DEFAULT_DEPARTMENT_LABELS: Record<string, string> = {
  finanzen: "Finanzen",
  it: "IT",
  marketing: "Marketing",
  operations: "Operations",
  produkt: "Produkt",
  sales: "Sales",
  zertifizierung: "Zertifizierung",
};

export type DefaultDeptSlug = (typeof DEFAULT_DEPARTMENT_SLUGS_ORDER)[number];
