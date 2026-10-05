// The backend's metric definitions are the source of truth, but a few use
// developer phrasing ("null if none", "APPROVE", "in the window",
// "approved / (approved + rejected)"). Reworded for the admin here, without
// changing what they say. Anything not matched is shown as sent.
const REWRITES: [RegExp, string][] = [
  [/;\s*null if none\.?$/i, ". Shows — when there were none."],
  [/\bnull if none\b/gi, "shown as — when there were none"],
  [/^approved \/ \(approved \+ rejected\)/i, "Approved ÷ (approved + rejected)"],
  [/^rejected \/ \(approved \+ rejected\)/i, "Rejected ÷ (approved + rejected)"],
  [/, decisions in the window/gi, ", for decisions in the period"],
  [/\bfinal APPROVE decision\b/g, "final approval"],
  [/\bin the window\b/gi, "in the period"],
  [/\(as of now\)/gi, "(right now)"],
];

export function plainDefinition(definition: string): string {
  return REWRITES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), definition.trim());
}
