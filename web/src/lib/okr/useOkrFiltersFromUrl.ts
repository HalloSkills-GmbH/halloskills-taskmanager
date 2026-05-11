"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { OkrFilters } from "@/lib/okr/filters";
import { parseOkrFilters } from "@/lib/okr/filters";

/** Liest die aktuelle URL und liefert dieselben OKR-Filter wie die Server-Seiten (`parseOkrFilters`). */
export function useOkrFiltersFromUrl(): OkrFilters {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  return useMemo(() => parseOkrFilters(new URLSearchParams(qs)), [qs]);
}
