// Generated at runtime via Vite glob import.
// Provides a map from base filename (lowercase, no extension) to URL.

// @ts-expect-error Vite glob import meta provided at build time
const modules = import.meta.glob("../assets/systems/*.{png,svg,jpg,jpeg}", {
  eager: true,
}) as Record<string, { default: string }>;

const logos: Record<string, string> = {};
for (const [path, mod] of Object.entries(modules)) {
  const file = path.split("/").pop() || "";
  const base = file.toLowerCase().replace(/\.(png|svg|jpe?g)$/, "");
  logos[base] = mod.default;
}

export function findLogo(key: string): string | undefined {
  const k = key.toLowerCase();
  // Simple alias map to handle locale differences (e.g., "favorites" -> "favoris")
  const aliases: Record<string, string[]> = {
    favorites: ["favoris"],
  };

  const candidates: string[] = [k, k.replace(/\s+/g, "-")];
  if (aliases[k]) {
    for (const alt of aliases[k]) {
      candidates.unshift(alt, alt.replace(/\s+/g, "-"));
    }
  }

  for (const c of candidates) {
    if (logos[c]) return logos[c];
  }
  return undefined;
}

export function allLogos() {
  return { ...logos };
}
