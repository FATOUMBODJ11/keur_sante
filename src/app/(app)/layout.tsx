import { Suspense, type ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { Loading } from "@/components/ui";

// Données chargées côté client après authentification : navigations non instantanées par nature.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
