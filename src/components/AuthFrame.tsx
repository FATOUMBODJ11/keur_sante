"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark, ThemeSeg } from "./ui";

/** Cadre des pages publiques (mot de passe oublié, réinitialisation, confidentialité), dans le style de l'accueil. */
export function AuthFrame({ title, lede, children }: { title: ReactNode; lede: string; children: ReactNode }) {
  return (
    <div className="site">
      <div className="site-frame">
        <div className="site-top">
          <header className="site-nav">
            <Link href="/bienvenue" className="site-brand" aria-label="Keur Santé — accueil">
              <BrandMark size={36} />
              <span className="brand-name">
                Keur <span>Santé</span>
              </span>
            </Link>
            <div className="site-actions">
              <ThemeSeg compact />
              <Link href="/bienvenue" className="btn btn-pill">
                <span className="lbl">Accueil</span>
                <span className="dot">
                  <ArrowLeft size={15} />
                </span>
              </Link>
            </div>
          </header>
          <section className="site-page">
            <div>
              <div className="eyebrow">Scribe médical ambiant · Sénégal</div>
              <h1>{title}</h1>
              <p className="lede">{lede}</p>
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
