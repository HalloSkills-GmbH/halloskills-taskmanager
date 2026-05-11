"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDepartment } from "@/lib/workspace/actions";

export function CreateDepartmentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const res = await createDepartment({ name });
          if (!res.ok) {
            setErr(res.message);
            return;
          }
          setName("");
          router.push(`/d/${res.slug}`);
          router.refresh();
        });
      }}
    >
      <label className="hs-field min-w-[14rem]">
        <span className="hs-field-label">Neue Abteilung</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Produkt, Sales, Ops"
          className="hs-input w-full"
          maxLength={120}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="hs-btn hs-btn-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Wird angelegt…" : "Anlegen"}
      </button>
      {err ? (
        <p className="w-full text-sm font-medium text-[var(--danger,#b42318)]">{err}</p>
      ) : null}
    </form>
  );
}
