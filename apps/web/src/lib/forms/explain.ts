// The API explains errors in English, for developers. These turn the
// messages a form can receive into French, and say how to fix the input
// (docs/CHARTE.md: an error says what happened and how to correct it).
// A message with no rule here is shown as the API wrote it.

export interface FieldContext {
  // Label of each field of the form, by API field name
  labels: Record<string, string>;
  // What the user typed, by field name, to count characters
  values?: Record<string, string>;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

// "«Nom» doit faire entre 2 et 64 caractères. Tu en as saisi 1 : ajoute au
// moins 1 caractère."
function lengthAdvice(length: number | undefined, min: number, max: number) {
  if (length === undefined) return "";
  if (length < min) {
    return ` Tu en as saisi ${length} : ajoute au moins ${plural(min - length, "caractère")}.`;
  }
  if (length > max) {
    return ` Tu en as saisi ${length} : retire au moins ${plural(length - max, "caractère")}.`;
  }
  return "";
}

const fieldRules: {
  pattern: RegExp;
  explain: (match: RegExpMatchArray, label: string, value?: string) => string;
}[] = [
  {
    pattern: /^\w+ must be between (\d+) and (\d+) characters$/,
    explain: ([, min, max], label, value) =>
      `«${label}» doit faire entre ${min} et ${max} caractères.` +
      lengthAdvice(value?.trim().length, Number(min), Number(max)),
  },
  {
    pattern: /^\w+ must be at most (\d+) characters$/,
    explain: ([, max], label, value) =>
      `«${label}» doit faire au plus ${max} caractères.` +
      lengthAdvice(value?.trim().length, 0, Number(max)),
  },
  {
    pattern: /^\w+ must be a string/,
    explain: (_, label) => `«${label}» est obligatoire : remplis ce champ.`,
  },
  {
    pattern: /^\w+ must be a date/,
    explain: (_, label) =>
      `«${label}» n'est pas une date valide : choisis un jour et une heure.`,
  },
  {
    pattern: /^each score must be (a whole number|0 or more)/,
    explain: () =>
      "Les scores doivent être des nombres entiers, 0 ou plus : corrige le score de chaque équipe.",
  },
  {
    pattern: /^A match cannot end in a tie/,
    explain: () =>
      "Un match ne peut pas finir à égalité : saisis le score qui a départagé les équipes.",
  },
  {
    pattern: /^winnerSlot must be 1 or 2/,
    explain: () => "Choisis l'équipe qui a gagné.",
  },
  {
    pattern: /^winnerSlot must be the slot with the higher score/,
    explain: () =>
      "Le vainqueur doit avoir le plus haut score : vérifie que les scores ne sont pas inversés.",
  },
  {
    pattern: /^reason is required to correct/,
    explain: () =>
      "Ce match a déjà un résultat : explique en quelques mots pourquoi il change.",
  },
  {
    pattern: /^\w+ must be a valid UUID/,
    explain: (_, label) =>
      `«${label}» n'est pas valide : choisis une option de la liste.`,
  },
];

export function explainFieldError(
  field: string,
  message: string,
  { labels, values = {} }: FieldContext,
): string {
  const label = labels[field] ?? field;
  // "endsAt must be after startsAt": two fields of the same form
  const after = message.match(/^(\w+) must be after (\w+)$/);
  if (after) {
    const other = labels[after[2]] ?? after[2];
    return `«${label}» doit être après «${other}» : choisis une date plus tardive.`;
  }
  for (const rule of fieldRules) {
    const match = message.match(rule.pattern);
    if (match) return rule.explain(match, label, values[field]);
  }
  return message;
}

const messageRules: [RegExp, (match: RegExpMatchArray) => string][] = [
  [
    /^This (team|player) is registered in (\d+) tournament\(s\)/,
    ([, kind, count]) =>
      `${kind === "team" ? "Cette équipe" : "Ce joueur"} est inscrit${kind === "team" ? "e" : ""} à ${plural(Number(count), "tournoi")} : retire${kind === "team" ? "-la" : "-le"} de ${Number(count) > 1 ? "ces tournois" : "ce tournoi"} avant de supprimer.`,
  ],
  [
    /^(.+) is already a member of this team$/,
    ([, handle]) => `${handle} fait déjà partie de cette équipe.`,
  ],
  [
    /^(.+) already belongs to (.+): remove them from that team first$/,
    ([, handle, team]) =>
      `${handle} fait déjà partie de ${team} : retire-le de cette équipe d'abord.`,
  ],
  [
    /^(.+) is already in this tournament$/,
    ([, team]) => `${team} est déjà inscrite à ce tournoi.`,
  ],
  [
    /^This tournament is (running|finished): only a draft tournament can be/,
    ([, status]) =>
      `Ce tournoi est ${status === "running" ? "en cours" : "terminé"} : seul un brouillon peut encore changer.`,
  ],
  [
    /^(.+) has a bye: there is no result to enter$/,
    ([, match]) =>
      `${match} est un match sans adversaire : il n'a pas de résultat.`,
  ],
  [
    /^(.+) cannot be played yet: both teams are not known$/,
    ([, match]) =>
      `${match} ne peut pas encore être joué : ses deux équipes ne sont pas connues.`,
  ],
  [
    /^Cannot reach the server/,
    () => "Le serveur ne répond pas : vérifie ta connexion et réessaie.",
  ],
];

// For errors not tied to a field (a refused deletion, a conflict)
export function explainMessage(message: string): string {
  for (const [pattern, explain] of messageRules) {
    const match = message.match(pattern);
    if (match) return explain(match);
  }
  return message;
}
