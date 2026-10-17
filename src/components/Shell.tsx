"use client";

import { ClipboardList, FlaskConical, LayoutDashboard, LogOut, Mic, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { dt } from "@/lib/client/api";
import type { Providers } from "@/lib/types";
import { RefreshProvider, useAuth, useAuthRedirect } from "./providers";
import { BrandMark, Loading, ThemeSeg } from "./ui";

function NavLink({ href, end, children }: { href: string; end?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const active = end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className={`nav-link ${active ? "active" : ""}`}>
      {children}
    </Link>
  );
}

/** Mise en page de l'application (barre latérale de la maquette). */
export function Shell({ children }: { children: ReactNode }) {
  const user = useAuthRedirect(true);
  const { logout } = useAuth();
  const pathname = usePathname();
  const [toReview, setToReview] = useState(0);
  const [providers, setProviders] = useState<Providers | null>(null);

  const refresh = useCallback(() => {
    dt.stats()
      .then((s) => setToReview(s.par_statut.review || 0))
      .catch(() => {});
  }, []);
  useEffect(refresh, [pathname, refresh]);
  useEffect(() => {
    dt.providers().then(setProviders).catch(() => {});
  }, []);

  if (!user) return <Loading label="Ouverture de la session…" />;
  const initials = user.full_name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const offline = providers && providers.llm_model === null;

  return (
    <RefreshProvider value={refresh}>
      <div className="shell">
        <aside className="sidebar">
          <Link href="/" className="brand" aria-label="Keur Santé — accueil">
            <BrandMark />
            <div>
              <div className="brand-name">
                Keur <span>Santé</span>
              </div>
              <div className="brand-tag">Scribe médical · FR / WO</div>
            </div>
          </Link>
          <Link href="/consultations/nouvelle" className="btn btn-primary nav-cta">
            <Mic size={16} />
            <span className="lbl">Nouvelle consultation</span>
          </Link>
          <div className="nav-section">Travail</div>
          <NavLink href="/" end>
            <LayoutDashboard size={17} />
            <span className="lbl">Tableau de bord</span>
          </NavLink>
          <NavLink href="/consultations" end>
            <ClipboardList size={17} />
            <span className="lbl">Consultations</span>
            {toReview > 0 && (
              <span className="count" title="Comptes rendus à valider">
                {toReview}
              </span>
            )}
          </NavLink>
          <div className="nav-section">Qualité</div>
          <NavLink href="/evaluation">
            <FlaskConical size={17} />
            <span className="lbl">Validation clinique</span>
          </NavLink>
          <div className="sidebar-foot">
            <div className="user-chip">
              <span className="avatar">{initials}</span>
              <div style={{ minWidth: 0 }}>
                <div className="strong" style={{ color: "var(--text)" }}>
                  {user.full_name}
                </div>
                <div className="tiny faint">{user.facility}</div>
              </div>
            </div>
            <ThemeSeg compact />
            <button className="btn btn-quiet btn-sm" onClick={logout} style={{ justifyContent: "flex-start" }}>
              <LogOut size={14} />
              Se déconnecter
            </button>
          </div>
        </aside>
        <main className="main">
          {offline && (
            <div className="demo-banner">
              <Sparkles size={15} />
              <span>
                <b>Mode hors-ligne.</b> Extraction par règles et base de connaissances ; transcription française par la
                dictée du navigateur. Configurez Claude et le serveur Whisper pour la version complète.
                {providers && !providers.wolof_enabled && " Le wolof est en pause."}
              </span>
            </div>
          )}
          {children}
        </main>
      </div>
    </RefreshProvider>
  );
}
