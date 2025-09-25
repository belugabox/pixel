// Generated at runtime via Vite glob import.
// Provides a map from base filename (lowercase, no extension) to URL.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
  if (logos[k]) return logos[k];
  const dashed = k.replace(/\s+/g, "-");
  if (logos[dashed]) return logos[dashed];
  return undefined;
}

export function allLogos() {
  return { ...logos };
}
