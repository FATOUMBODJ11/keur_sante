# Keur Santé — prototype

Scribe médical ambiant pour les consultations en **français** et en **wolof**. L'agent transcrit, traduit,
extrait les informations cliniques et prépare un compte rendu **SOAP**. Il propose ensuite des pistes
diagnostiques et une prise en charge, que le médecin accepte ou rejette une à une avant de valider.
Rien n'est archivé sans validation médicale.

Application Next.js 16 (App Router), avec l'interface et l'API dans le même projet.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000. Vous pouvez **créer votre compte praticien** depuis la page d'accueil (« Créer un compte »), ou utiliser le compte de démonstration `demo@keursante.sn` / `keursante`. Chaque praticien ne voit que ses propres consultations.

L'interface reprend la maquette `Keur Santé.html` : même feuille de style, logo, fond animé (three.js) et écrans.
L'application démarre **vide**. Elle ne contient ni consultation ni cas inventés : vous la testez avec vos propres consultations.

> **Wolof en pause.** Pour l'instant, l'application fonctionne en **français seul** : le choix de langue, Kiriku-Wolof-ASR, la traduction et les cas en wolof sont masqués. Tout le code reste en place. Pour réactiver le wolof, ajoutez `KS_WOLOF=on` dans `.env.local`.

Sans configuration, l'application fonctionne **hors-ligne** :
- **Micro, français** : transcription en direct par la dictée du navigateur (Web Speech API, dans Chrome ou Edge). Vous indiquez qui parle (Médecin / Patient), puis vous corrigez la transcription avant l'analyse. L'audio est traité par le service de reconnaissance du navigateur ; pour de vraies données de patients, utilisez le serveur Whisper local.
- **Micro, wolof** : nécessite le serveur Kiriku-Wolof-ASR (voir plus bas). La dictée du navigateur ne reconnaît pas le wolof.
- **Saisie** : vous tapez ou collez la transcription.
- **Analyse** : moteur de règles pour l'extraction, base de connaissances pour les pistes, glossaire pour la traduction wolof → français.

> Testez le micro dans **Chrome ou Edge** à l'adresse http://localhost:3000. Le navigateur intégré d'un éditeur ne permet généralement pas la dictée.

## Fonctionnalités

| Module | Ce que fait l'application |
|---|---|
| **Accès** | Création de compte, connexion, mot de passe oublié (e-mail ou lien généré par l'administrateur), changement de mot de passe, verrouillage après 5 échecs, profil (structure, type, spécialité), administration (KS_ADMIN_EMAILS) |
| **Patients** | Code pseudonyme, fiche patient : historique, allergies, antécédents, traitements, notes ; dossier pris en compte par l'analyse et enrichi à chaque validation |
| **Consultation** | Double consentement, micro avec transcription en direct, détection automatique Médecin / Patient, pause et reprise, saisie rapide des constantes, saisie manuelle |
| **Agent IA** | Extraction, pistes diagnostiques (CIM-10, score, arguments), signes d'alerte, alerte d'allergie, prise en charge, SOAP, trace ; Claude pour tout type de consultation, règles hors-ligne en secours |
| **Relecture** | Retenir ou écarter chaque piste, modifier le SOAP, corriger la transcription et relancer l'analyse, valider, archiver |
| **Documents** | Export texte, compte rendu imprimable et PDF (en-tête de la structure, signature) |
| **Validation clinique** | Jeu de cas par famille, médecin validateur, réannotation à l'aveugle, accord intra-annotateur (kappa), métriques par composant et par famille, export CSV |
| **Usage** | Questionnaire SUS (System Usability Scale), temps gagné déclaré |
| **Pilotage** | Tableau de bord : activité sur 8 semaines, diagnostics les plus retenus, délai médian jusqu'à la validation |
| **Conformité** | Page de confidentialité, journal d'audit, isolement des données entre praticiens |

Le document d'accès pour le correcteur (URL, identifiants, scénario) est dans [`docs/ACCES_PROTOTYPE.md`](docs/ACCES_PROTOTYPE.md).

## Correspondance avec le cahier des charges

| Cahier des charges | Où dans le code |
|---|---|
| A. Gestion de la consultation, consentement | `src/app/(app)/consultations/nouvelle`, `src/lib/consultations.ts` |
| B. Reconnaissance vocale (Whisper FR, Kiriku-Wolof-ASR WO) | `src/lib/agent/asr.ts`, `services/asr/` |
| C. Traduction wolof → français | `src/lib/agent/translate.ts` |
| D. Extraction des informations médicales | `src/lib/agent/extract.ts` |
| E. Génération du SOAP | `src/lib/agent/soap.ts` |
| F. Suggestions médicales | `src/lib/agent/suggest.ts`, `src/lib/data/knowledge.ts` |
| G. Validation médicale | `src/app/(app)/consultations/[id]`, `validate()` dans `src/lib/consultations.ts` |
| 6. Agent orchestrateur, avec trace | `src/lib/agent/index.ts` |
| 7. Jeu de cas annotés (saisi par vous) | page `/evaluation`, `src/lib/cases.ts` |
| 4.11–4.12 Évaluation par composant | `src/lib/eval.ts`, page `/evaluation` |

## Architecture de l'agent

```
Audio ─► Détection langue ─► ASR (Whisper | Kiriku-Wolof) ─► Traduction ─► Extraction ─► SOAP ─► Suggestions ─► Validation médecin ─► Archivage
```

Chaque outil a deux implémentations : un **LLM** (Claude) et un **repli hors-ligne**. Si le LLM échoue,
l'agent bascule sur le repli et le signale dans la trace, qui s'affiche sur la page de revue.

## Activer le LLM (facultatif)

Dans `.env.local` (modèle dans `.env.example`) :

```
ANTHROPIC_API_KEY=...
```

Claude est activé dès que la clé est présente. Pour forcer le moteur de règles, mettez `KS_LLM_PROVIDER=rules`. L'analyse tient compte du dossier du patient (âge, sexe, allergies, antécédents, traitements). Elle ne donne jamais de posologie chiffrée, et une alerte apparaît si une suggestion contredit une allergie connue.

Le modèle par défaut est `claude-opus-5-5`. La sortie est structurée et validée par un schéma Zod. ⚠️ La
transcription, pseudonymisée, est alors envoyée à l'API Anthropic. Vérifiez la conformité avec la CDP
(loi 2008-12) avant d'utiliser de vraies données.

## Service de reconnaissance vocale (facultatif)

```bash
cd services/asr
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
set HF_TOKEN=<votre jeton Hugging Face>
uvicorn app:app --port 8001
```

Ajoutez ensuite dans `.env.local` :

```
ASR_FR_URL=http://localhost:8001/v1/audio/transcriptions
ASR_WO_URL=http://localhost:8001/v1/audio/transcriptions/wolof
```

Le wolof utilise **[Kiriku-Wolof-ASR](https://huggingface.co/AIHubSN/Kiriku-Wolof-ASR)** (AI Hub Senegal). C'est un Whisper large-v2 affiné pour le wolof, sous licence Apache-2.0. Points à connaître :
- le modèle est en **accès restreint** : connectez-vous sur Hugging Face, acceptez ses conditions, puis créez un jeton (`HF_TOKEN`) ;
- il compte environ 2 milliards de paramètres : un **GPU** est fortement conseillé ;
- **ffmpeg** doit être installé pour décoder l'audio du navigateur, qui est ré-échantillonné en 16 kHz.

L'audio n'est jamais stocké.

## Évaluation (§ 7)

La page `/evaluation` lance l'agent sur les cas annotés. Elle mesure séparément :
- la détection de langue ;
- le F1 des symptômes et des constantes ;
- le diagnostic, en top-1 et en top-3 ;
- la concordance du plan ;
- la complétude du SOAP ;
- la préservation des termes cliniques après traduction ;
- le WER, si un cas fournit `asr_hypothesis`.

Le jeu de cas est **vide au départ**. Vous l'alimentez depuis la page `/evaluation` (« Ajouter un cas »), ou depuis une consultation validée (« Ajouter au jeu de cas »). Dans ce second cas, seule la transcription est reprise : la référence (diagnostic, symptômes, plan) doit être établie par un professionnel de santé, **indépendamment des propositions de l'IA**.

**Limites à garder en tête :**
- Tant qu'une référence n'est pas cochée « validée par un professionnel de santé », le score ne mesure pas une concordance clinique (§ 7.2).
- La base de connaissances et les plans de prise en charge (`src/lib/data/knowledge.ts`) sont des contenus de démonstration, à faire relire au regard des protocoles nationaux.
- Le moteur de règles est volontairement simple. Le LLM donne de meilleurs résultats sur une parole spontanée.

## Données

- **En local**, sans configuration, les données vont dans `data/keur-sante.json` (ignoré par git).
- **En ligne**, elles vont dans **Postgres (Supabase)** dès que `DATABASE_URL` est défini (`src/lib/store.ts`).

Dans les deux cas :
- le patient n'est identifié que par un **code pseudonyme** ;
- chaque action est inscrite dans un **journal d'audit**.

## Déploiement sur Vercel avec Supabase

**1. Supabase (la base)**
1. Créez un projet sur [supabase.com](https://supabase.com). Choisissez une région proche, par exemple `eu-west-3` (Paris), et notez le mot de passe de la base.
2. *(Facultatif)* Ouvrez **SQL Editor** et exécutez `supabase/schema.sql`. Sinon, l'application crée elle-même ses tables au premier accès.
3. Cliquez sur **Connect** et copiez la chaîne **Transaction pooler** (port **6543**). Remplacez `[YOUR-PASSWORD]` par le mot de passe de la base.

**2. Vercel (l'application)**
1. Sur [vercel.com/new](https://vercel.com/new), importez le dépôt GitHub `keur_sante`. Vercel détecte Next.js tout seul.
2. Avant de cliquer sur **Deploy**, ouvrez **Environment Variables** et ajoutez :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | la chaîne Transaction pooler de Supabase |
| `KS_SESSION_SECRET` | une longue valeur aléatoire (32 caractères au moins) |
| `KS_DEMO_ACCOUNT` | `off` si vous ne voulez pas du compte de démonstration en ligne (gardez-le pour le jury) |
| `KS_ADMIN_EMAILS` | adresses des administrateurs (page Administration), séparées par des virgules |
| `RESEND_API_KEY`, `KS_MAIL_FROM` | facultatif : envoi des e-mails de réinitialisation du mot de passe |
| `ANTHROPIC_API_KEY` | analyse par Claude (recommandé) |

3. Cliquez sur **Deploy**. Ensuite, chaque `git push` sur `main` redéploie automatiquement.

**À savoir :**
- Les tables Supabase ont la sécurité par ligne (RLS) activée, sans règle d'accès : seule l'application, connectée directement à Postgres, peut lire et écrire. L'API publique de Supabase ne voit rien.
- Le micro fonctionne en ligne : Vercel sert le site en HTTPS. La dictée passe par le navigateur (Chrome ou Edge).
- Les serveurs Whisper et Kiriku ne tournent pas sur Vercel. Il faut les héberger ailleurs (machine avec GPU), puis renseigner `ASR_FR_URL` et `ASR_WO_URL`.
- Prototype : avant d'y mettre de vraies données de patients, vérifiez la conformité avec la loi 2008-12 (CDP) et choisissez un hébergement adapté.
