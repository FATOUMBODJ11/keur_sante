"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AuthFrame } from "@/components/AuthFrame";

const SECTIONS: [string, string[]][] = [
  [
    "Données traitées",
    [
      "Comptes praticiens : nom, structure, spécialité, adresse e-mail, mot de passe (stocké sous forme chiffrée irréversible).",
      "Patients : un code pseudonyme (KS-P-…), le sexe, l'année de naissance et le dossier clinique (allergies, antécédents, traitements). Aucun nom, aucun numéro de téléphone, aucune adresse.",
      "Consultations : transcription, informations extraites, compte rendu et décisions du praticien.",
      "L'audio n'est jamais conservé : il est transcrit puis supprimé.",
    ],
  ],
  [
    "Finalité",
    [
      "Aider le praticien à documenter ses consultations. Les suggestions de l'IA ne constituent pas une décision médicale : le praticien relit, corrige et valide tout compte rendu avant son archivage.",
    ],
  ],
  [
    "Consentement",
    [
      "Aucune capture sans le double consentement, recueilli et horodaté dans l'application : le patient (informé dans la langue de son choix) et le praticien.",
    ],
  ],
  [
    "Accès et traçabilité",
    [
      "Chaque praticien n'accède qu'à ses propres patients et consultations.",
      "Chaque action (connexion, analyse, modification, validation, export…) est inscrite dans un journal d'audit.",
      "Verrouillage temporaire du compte après plusieurs échecs de connexion.",
    ],
  ],
  [
    "Sous-traitants techniques",
    [
      "Hébergement de l'application : Vercel. Base de données : Supabase (Postgres).",
      "Analyse par IA, si elle est activée : la transcription pseudonymisée est transmise à l'API Anthropic (Claude).",
      "Dictée en direct dans le navigateur : l'audio est traité par le service de reconnaissance du navigateur (Google pour Chrome, Microsoft pour Edge). Pour de vraies données de patients, privilégier le serveur de transcription local.",
    ],
  ],
  [
    "Cadre légal",
    [
      "Loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel (Sénégal) et Commission de protection des données personnelles (CDP).",
      "Ce prototype est réalisé dans le cadre d'un Mastère Stratégie Digitale (ISM Digital Campus). Avant toute utilisation avec de vraies données de patients : déclaration auprès de la CDP, hébergement adapté aux données de santé et durée de conservation définie.",
    ],
  ],
  [
    "Vos droits",
    [
      "Droit d'accès, de rectification et de suppression : adressez votre demande à l'administrateur de la plateforme.",
    ],
  ],
];

export default function Privacy() {
  return (
    <AuthFrame title={<>Confidentialité et protection des données</>} lede="Comment Keur Santé traite les données des praticiens et des patients.">
      <div className="auth-card" style={{ maxWidth: 640 }}>
        {SECTIONS.map(([title, items]) => (
          <div key={title} className="stack" style={{ gap: 6 }}>
            <h2 style={{ fontSize: 16 }}>{title}</h2>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              {items.map((x) => (
                <li key={x} style={{ marginBottom: 4 }}>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link href="/bienvenue" className="row small strong" style={{ gap: 6, justifyContent: "center" }}>
          <ArrowLeft size={14} />
          Retour à l&apos;accueil
        </Link>
      </div>
    </AuthFrame>
  );
}
