"use client";

import { Stethoscope } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark, ThemeSeg } from "./ui";
import { Waves } from "./Waves";

/** Cadre des pages publiques (mot de passe oublié, réinitialisation, confidentialité), dans le style de l'accueil. */
export function AuthFrame({ title, lede, children }: { title: ReactNode; lede: string; children: ReactNode }) {
  return (
    <div className="landing">
      <section className="hero">
        <Waves zoom={1.2} gain={1.5} size={11} offsetY={0.42} />
        <div className="hero-brand">
          <BrandMark size={44} />
          <div className="brand-name">
            Keur <span>Santé</span>
          </div>
        </div>
        <div className="hero-copy">
          <div className="eyebrow" style={{ color: "#A7E9A7" }}>
            <Stethoscope size={14} />
            Scribe médical ambiant · Sénégal
          </div>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
      </section>
      <section className="auth">
        <div className="theme-toggle">
          <ThemeSeg compact />
        </div>
        {children}
      </section>
    </div>
  );
}
