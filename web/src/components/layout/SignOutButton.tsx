"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.replace("/login");
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      title="Abmelden"
      aria-label="Abmelden"
      className="hs-iconbtn shrink-0 text-[var(--danger)] hover:text-[var(--danger)]"
    >
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M10 17H5a2 2 0 01-2-2V9a2 2 0 012-2h5M14 15l4-3-4-3M18 12H8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
