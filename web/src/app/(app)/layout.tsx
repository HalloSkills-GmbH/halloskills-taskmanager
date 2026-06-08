import { Suspense } from "react";
import { AppSidebarLoader } from "@/components/layout/AppSidebarLoader";
import { AsideNavSkeleton } from "@/components/layout/AsideNavSkeleton";
import { PageTitleProvider } from "@/components/layout/PageTitleContext";
import { ProductMainChrome } from "@/components/layout/ProductShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <div className="hs-app grid min-h-screen grid-cols-[232px_minmax(0,1fr)] bg-[var(--bg)]">
        <Suspense fallback={<AsideNavSkeleton />}>
          <AppSidebarLoader />
        </Suspense>
        <ProductMainChrome>{children}</ProductMainChrome>
      </div>
    </PageTitleProvider>
  );
}
