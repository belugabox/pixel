// Utilitaires de filtrage de fichiers (extensions autorisées, motifs d'exclusion)
// - Insensibles à la casse
// - Prise en charge des jokers * et ?
// - Correspondance sur le nom de fichier complet et sur le basename (sans extension)

import path from "node:path";

function normalizePatterns(patterns: string[] | undefined): string[] {
  return (patterns || [])
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function toRegex(p: string): RegExp {
  // Échapper caractères spéciaux regex (sans inclure / car non nécessaire dans RegExp constructor)
  const escaped = p.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${pattern}$`, "i");
}

function removeExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/**
 * Détermine si un fichier doit être exclu selon une liste de motifs
 */
export function shouldExclude(fileName: string, patterns?: string[]): boolean {
  const pats = normalizePatterns(patterns);
  if (pats.length === 0) return false;

  const lower = fileName.toLowerCase();
  const base = removeExt(lower);
  const regexes = pats.map((p) => toRegex(p));
  const excludeBases = pats
    .map((p) => (p.split(/[\\/]/).pop() || p))
    .map((p) => removeExt(p));

  // 1) Correspondance exacte via regex (nom complet)
  if (regexes.some((rx) => rx.test(lower))) return true;
  // 2) Correspondance sur le basename sans extension
  if (excludeBases.includes(base)) return true;
  // 3) File contains motif en secours
  if (pats.some((p) => p && lower.includes(p))) return true;

  return false;
}

/**
 * Filtre une liste de fichiers selon extensions autorisées et motifs d'exclusion.
 * Retourne les fichiers conservés et la liste de ceux exclus pour log/debug.
 */
export function filterRoms(
  files: string[],
  opts?: { extensions?: string[] | null; exclude?: string[] }
): { kept: string[]; excluded: string[] } {
  const allowed = normalizePatterns(opts?.extensions || undefined);
  const pats = normalizePatterns(opts?.exclude || undefined);

  const kept: string[] = [];
  const excluded: string[] = [];

  for (const name of files) {
    // extensions autorisées
    if (allowed.length > 0) {
      const ext = path.extname(name).toLowerCase();
      if (!allowed.includes(ext)) {
        excluded.push(name);
        continue;
      }
    }
    // motifs d'exclusion
    if (shouldExclude(name, pats)) {
      excluded.push(name);
      continue;
    }
    kept.push(name);
  }

  return { kept, excluded };
}
