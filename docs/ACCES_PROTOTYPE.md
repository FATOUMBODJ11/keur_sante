# Keur Santé — Accès au prototype et scénario utilisateur

*Document destiné au correcteur (Mastère Stratégie Digitale — ISM Digital Campus).*

## Accès

| | |
|---|---|
| **Adresse** | https://keur-sante.vercel.app |
| **Compte de démonstration** | `demo@keursante.sn` |
| **Mot de passe** | `keursante` |
| **Navigateur conseillé** | Google Chrome ou Microsoft Edge (ordinateur ou tablette), pour la dictée au micro |

Vous pouvez aussi créer votre propre compte depuis la page d'accueil (« Créer un compte »).

> Le compte de démonstration est partagé : d'autres visiteurs peuvent y voir des consultations. Aucune donnée réelle de patient n'y figure.

## Scénario utilisateur (10 minutes environ)

### 1. Se connecter
Sur la page d'accueil, l'adresse et le mot de passe de démonstration sont déjà renseignés. Cliquez sur **Ouvrir la démonstration**. Le **tableau de bord** s'affiche avec les indicateurs : consultations, comptes rendus à valider, pistes IA retenues, activité des 8 dernières semaines.

### 2. Démarrer une consultation
1. Cliquez sur **Nouvelle consultation**.
2. Choisissez **Nouveau** patient, indiquez le sexe et l'année de naissance. Aucun nom n'est demandé : un code pseudonyme est attribué automatiquement.
3. Cochez les **deux consentements** (patient et praticien), puis cliquez sur **Commencer la capture**.

### 3. Capturer la consultation
**Option A — au micro.** Cliquez sur le bouton micro et autorisez le navigateur à l'utiliser. Jouez une courte consultation à voix haute, par exemple :
> « Bonjour, qu'est-ce qui vous amène ? »
> « Docteur, j'ai mal à la gorge depuis deux jours et j'ai de la fièvre. »
> « Vous toussez ? » — « Non. »

La transcription s'affiche en direct et chaque phrase est attribuée automatiquement au **Médecin** ou au **Patient**. Vous pouvez mettre en **pause**, ouvrir **Constantes** pour saisir par exemple une température de 38,6, puis arrêter l'enregistrement, relire le texte et cliquer sur **Analyser la consultation**.

**Option B — saisie.** Cliquez sur **Saisie**, collez le texte suivant, puis cliquez sur **Analyser la consultation** :

```
Médecin: Bonjour, qu'est-ce qui vous amène ?
Patient: J'ai mal à la gorge depuis deux jours, j'ai mal à avaler et j'ai de la fièvre.
Médecin: Vous toussez ?
Patient: Non.
Médecin: Température 38,6 degrés. Amygdales rouges et augmentées de volume.
```

### 4. Suivre l'agent IA
Les étapes de l'agent s'enchaînent : langue, transcription, extraction, pistes diagnostiques, compte rendu SOAP, puis validation par le médecin.

### 5. Relire et valider
Sur le compte rendu, vous trouvez :
- la transcription surlignée (symptômes, signes absents, constantes) ;
- les informations extraites ;
- le compte rendu **SOAP**, modifiable avec **Modifier** ;
- les **pistes diagnostiques**, avec score, code CIM-10 et arguments, et la **prise en charge suggérée**.

Ensuite :
1. **Retenez ou écartez** chaque piste. La validation reste impossible tant que toutes ne sont pas tranchées.
2. Cliquez sur **Valider le compte rendu**.
3. Testez **Imprimer / PDF** (compte rendu avec en-tête de la structure et zone de signature), **Exporter** et **Archiver**.

### 6. Dossier patient
Ouvrez le menu **Patients**, puis le patient créé. Ajoutez une allergie, par exemple « pénicilline », puis lancez une **nouvelle consultation** pour ce patient avec le même texte. L'agent affiche une **alerte d'allergie** si une suggestion contient de l'amoxicilline.

### 7. Validation clinique
1. Ouvrez **Validation clinique**, puis cliquez sur **Ajouter un cas** : transcription, diagnostic de référence, symptômes, plan, famille de pathologies.
2. Cliquez sur **Lancer une évaluation**. Vous obtenez les métriques par composant et par famille, ainsi que l'accord intra-annotateur après une **réannotation**. Le bouton **Exporter (CSV)** produit le fichier des résultats.

### 8. Questionnaire d'usage
Ouvrez **Questionnaire d'usage** et répondez aux 10 affirmations du **SUS** (System Usability Scale). Le score moyen et le temps gagné déclaré s'affichent.

## Remarques

- **Analyse** : sans clé d'API Claude, l'analyse repose sur un moteur de règles hors-ligne (bandeau « Mode hors-ligne »). Avec la clé, Claude analyse tout type de consultation.
- **Wolof** : prévu (traduction et reconnaissance vocale du wolof), mais en pause dans cette version. Il sera activé une fois le moteur de reconnaissance vocale choisi.
