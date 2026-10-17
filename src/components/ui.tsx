"use client";

import {
  Check,
  Circle,
  CircleDashed,
  CircleX,
  LoaderCircle,
  Monitor,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { STATUS, STEP_LABELS, STEP_ORDER } from "@/lib/client/format";
import type { ConsultationStatus, Lang, Step } from "@/lib/types";

/* Logo de la maquette */
export function BrandMark({ size = 42 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" style={{ width: size * 0.8, height: size * 0.8 }} />
    </span>
  );
}

export function StatusBadge({ status }: { status: ConsultationStatus }) {
  const s = STATUS[status] ?? { label: status, cls: "b-grey" };
  return (
    <span className={`badge ${s.cls}`}>
      <span className="pip" />
      {s.label}
    </span>
  );
}

export function LangTag({ code }: { code: Lang | null | undefined }) {
  return code ? (
    <span className={`lang ${code}`} title={code === "wo" ? "Wolof" : "Français"}>
      {code}
    </span>
  ) : null;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 920 } : undefined}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn btn-quiet btn-icon btn-sm" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="empty">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

/* ---------- Thème : système / clair / sombre ---------- */

type Theme = "system" | "light" | "dark";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("ks_theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") delete el.dataset.theme;
  else el.dataset.theme = t;
}

export function ThemeSeg({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  // Lecture après montage : localStorage n'existe pas au rendu serveur.
  useEffect(() => {
    const t = readTheme();
    if (t !== "system") queueMicrotask(() => setTheme(t));
  }, []);
  const choose = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem("ks_theme", t);
    } catch {}
  };
  const opts: [Theme, typeof Monitor, string][] = [
    ["system", Monitor, "Système"],
    ["light", Sun, "Clair"],
    ["dark", Moon, "Sombre"],
  ];
  return (
    <div className="seg" role="group" aria-label="Thème">
      {opts.map(([k, Icon, label]) => (
        <button
          key={k}
          className={theme === k ? "on" : ""}
          onClick={() => choose(k)}
          title={label}
          aria-pressed={theme === k}
          style={compact ? { padding: "5px 8px" } : undefined}
        >
          <Icon size={14} style={{ verticalAlign: -2 }} />
          {!compact && <span style={{ marginLeft: 6 }}>{label}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Étapes de l'agent ---------- */

export function AgentSteps({ steps = [], live = -1, compact }: { steps?: Step[]; live?: number; compact?: boolean }) {
  const byName = Object.fromEntries(steps.map((s) => [s.name, s]));
  const names = [...STEP_ORDER, ...(steps.some((s) => s.name === "archivage") ? (["archivage"] as const) : [])];
  return (
    <div className="agent-steps">
      {names.map((name, i) => {
        const s = byName[name];
        let st: string = s?.status || "pending";
        if (live >= 0) st = i < live ? s?.status || "done" : i === live ? "running" : "pending";
        if (live >= 0 && name === "validation_medecin" && i <= live) st = "pending";
        const Icon = st === "done" ? Check : st === "running" ? LoaderCircle : st === "error" ? CircleX : st === "skipped" ? CircleDashed : Circle;
        const detail = st === "running" ? "en cours…" : [s?.provider, s?.detail].filter(Boolean).join(" · ");
        return (
          <div key={name} className={`agent-step ${st}`}>
            <span className="dot">
              <Icon size={14} className={st === "running" ? "spin" : ""} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="t">{STEP_LABELS[name] || name}</div>
              {!compact && detail && <div className="d">{st === "skipped" ? `Non requise · ${detail}` : detail}</div>}
            </div>
            <span className="ms">
              {st === "done" && s?.duration_ms != null && live < 0
                ? `${s.duration_ms} ms`
                : st === "pending" && name === "validation_medecin"
                  ? "humain"
                  : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
