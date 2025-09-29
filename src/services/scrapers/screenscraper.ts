import { BaseScraper } from "./base-scraper";
import * as path from "path";
import { ScrapedGame, ScrapedMedia, ScraperCredentials, ImageType } from "./types";
import { getCatalog } from "../../config";

// Note: media objects from ScreenScraper responses are loosely typed

export interface ScreenScraperCredentials extends ScraperCredentials {
  ssid?: string;
  sspassword?: string;
  devid?: string;
  devpassword?: string;
  softname?: string;
}

export class ScreenScraperScraper extends BaseScraper {
  protected readonly name = "ScreenScraper";
  protected readonly userAgent = "pixel-frontend/0.0.1";
  // Align with official docs host
  private readonly baseUrl = "https://api.screenscraper.fr/api2";

  constructor(private credentials: ScreenScraperCredentials = {}) {
    super(credentials);
  }

  async searchGame(
    romFileName: string,
    systemId: string,
  ): Promise<ScrapedGame | null> {
    try {
      // If neither user nor developer credentials are provided, ScreenScraper may reject requests.
      // Avoid hitting the API in that case and surface a clear warning instead of a JSON parse error.
      const hasUserCreds = !!(this.credentials?.ssid && this.credentials?.sspassword);
      const hasDevCreds = !!(this.credentials?.devid && this.credentials?.devpassword);
      if (!hasUserCreds && !hasDevCreds) {
        console.warn(
          "ScreenScraper credentials missing: provide either user (ssid + sspassword) or developer (devid + devpassword)."
        );
        return null;
      }
      // Remove file extension and clean filename
      const cleanName = this.cleanRomName(romFileName);
      const sysInput =
        typeof systemId === "string" ? systemId.trim() : systemId;
      const systeme = this.getSystemId(sysInput) || sysInput;

      // Step 0: try direct game info using rom filename (romnom)
      // This may directly return the right game for filename-like queries (e.g., mslug5)
      {
        // The API behaves better without the file extension for romnom
        const romNomNoExt = path.parse(romFileName).name;
        const infoFirstParams = new URLSearchParams({
          output: "json",
          systemeid: systeme,
          romtype: "rom",
          romnom: romNomNoExt,
        });
        this.appendAuthParams(infoFirstParams);
        const infoFirstUrl = `${this.baseUrl}/jeuInfos.php?${infoFirstParams.toString()}`;
        console.log(
          `[ScreenScraper] GET ${redactUrl(infoFirstUrl)} (first pass romnom)`,
        );
        const infoFirstResp = await fetch(infoFirstUrl, {
          headers: { "User-Agent": this.userAgent },
        });
        if (infoFirstResp.ok) {
          const infoFirstData = await parseJsonSafe(infoFirstResp, "info");
          if (infoFirstData && !hasHeaderError(infoFirstData)) {
            const jeu0 = getJeu(infoFirstData);
            if (jeu0) {
              return this.mapToScrapedGame(jeu0);
            }
          }
        } else if (infoFirstResp.status === 429) {
          console.warn("ScreenScraper API rate limit exceeded");
          return null;
        }
      }

      // Step 1: search by name to get the game id
      const searchParams = new URLSearchParams({
        output: "json",
        systemeid: systeme,
        langue: "fr",
        // Per docs, use 'recherche' for jeuRecherche.php
        recherche: cleanName,
      });
      this.appendAuthParams(searchParams);

      const searchUrl = `${this.baseUrl}/jeuRecherche.php?${searchParams.toString()}`;
      console.log(`[ScreenScraper] GET ${redactUrl(searchUrl)}`);
      const searchResp = await fetch(searchUrl, {
        headers: { "User-Agent": this.userAgent },
      });

      if (!searchResp.ok) {
        if (searchResp.status === 429) {
          console.warn("ScreenScraper API rate limit exceeded");
          return null;
        }
        const msg = await safeReadText(searchResp);
        console.error(
          `ScreenScraper search error ${searchResp.status}: ${msg}`,
        );
        return null;
      }

      const searchData = await parseJsonSafe(searchResp, "search");
      if (!searchData) return null;
      if (hasHeaderError(searchData)) {
        console.error(
          "ScreenScraper search API error:",
          searchData.header.erreur,
        );
        return null;
      }

      let first = this.pickFirstSearchResult(searchData);

      // Fallback: retry search using 'romnom' when 'recherche' yields nothing (helps cases like 'mslug5')
      if (!first) {
        const fallbackParams = new URLSearchParams({
          output: "json",
          systemeid: systeme,
          langue: "fr",
          romnom: cleanName,
        });
        this.appendAuthParams(fallbackParams);
        const fallbackUrl = `${this.baseUrl}/jeuRecherche.php?${fallbackParams.toString()}`;
        console.log(`[ScreenScraper] GET ${redactUrl(fallbackUrl)} (fallback romnom)`);
        const fbResp = await fetch(fallbackUrl, {
          headers: { "User-Agent": this.userAgent },
        });
        if (fbResp.ok) {
          const fbData = await parseJsonSafe(fbResp, "search");
          if (fbData && !hasHeaderError(fbData)) {
            first = this.pickFirstSearchResult(fbData);
          }
        }
      }
      const idCandidate = first?.id ?? first?.jeuid ?? first?.idJeu;
      const gameId = idCandidate != null ? String(idCandidate) : undefined;
      if (!gameId) {
        return null;
      }

      // Step 2: fetch details by jeuid
      const infoParams = new URLSearchParams({
        output: "json",
        // Per docs, use 'gameid' to force by numeric game id
        gameid: String(gameId),
        // Include systeme id as documented
        systemeid: systeme,
      });
      this.appendAuthParams(infoParams);
      const infoUrl = `${this.baseUrl}/jeuInfos.php?${infoParams.toString()}`;
      console.log(`[ScreenScraper] GET ${redactUrl(infoUrl)}`);
      const infoResp = await fetch(infoUrl, {
        headers: { "User-Agent": this.userAgent },
      });

      if (!infoResp.ok) {
        if (infoResp.status === 429) {
          console.warn("ScreenScraper API rate limit exceeded");
          return null;
        }
        const msg = await safeReadText(infoResp);
        console.error(`ScreenScraper info error ${infoResp.status}: ${msg}`);
        return null;
      }

      const infoData = await parseJsonSafe(infoResp, "info");
      if (!infoData) return null;
      if (hasHeaderError(infoData)) {
        console.error("ScreenScraper info API error:", infoData.header.erreur);
        return null;
      }

      const jeu = getJeu(infoData);

      if (jeu) {
        return this.mapToScrapedGame(jeu);
      }

      return null;
    } catch (error) {
      console.error("Error searching ScreenScraper:", error);
      return null;
    }
  }

  private appendAuthParams(params: URLSearchParams) {
    const { ssid, sspassword, devid, devpassword, softname } =
      this.credentials || {};
    if (ssid) params.set("ssid", ssid);
    if (sspassword) params.set("sspassword", sspassword);
    if (devid) params.set("devid", devid);
    if (devpassword) params.set("devpassword", devpassword);
    params.set("softname", softname || "pixel");
  }

  private pickFirstSearchResult(data: unknown): IdCarrier | null {
    if (!isObject(data)) return null;
    const resp = data["response"];
    if (!isObject(resp) && !Array.isArray(resp)) return null;
    if (Array.isArray(resp)) {
      const first = resp[0];
      return isObject(first) ? coerceIdCarrier(first) : null;
    }
    const r = resp as Record<string, unknown>;
    const jeux = r["jeux"];
    if (Array.isArray(jeux)) {
      const first = jeux[0];
      return isObject(first) ? coerceIdCarrier(first) : null;
    }
    const jeu = r["jeu"];
    if (Array.isArray(jeu)) {
      const first = jeu[0];
      return isObject(first) ? coerceIdCarrier(first) : null;
    }
    if (isObject(jeux)) {
      const innerJeu = (jeux as Record<string, unknown>)["jeu"];
      if (Array.isArray(innerJeu)) {
        const first = innerJeu[0];
        return isObject(first) ? coerceIdCarrier(first) : null;
      }
    }
    if (isObject(jeu)) return coerceIdCarrier(jeu);
    return null;
  }

  protected getSystemId(systemId: string): string | null {
    // Lire l'ID ScreenScraper depuis le catalog uniquement (pas de fallback interne)
    try {
      const catalog = getCatalog();
      const sys = catalog.systems.find(
        (s) => s.id.toLowerCase() === String(systemId).toLowerCase(),
      ) as (typeof catalog.systems[number] & { scrapers?: { screenscraper?: { systemId?: string } } }) | undefined;
      const idFromCatalog = sys?.scrapers?.screenscraper?.systemId;
      if (idFromCatalog && String(idFromCatalog).trim().length > 0) {
        return String(idFromCatalog);
      }
    } catch (e) {
      console.warn("[ScreenScraper] getSystemId: catalog lookup failed", e);
    }
    return null;
  }

  protected getImageType(mediaType: string): ImageType | null {
    // Map ScreenScraper media types to our internal types
    const t = mediaType.toLowerCase();
    if (t === "box-2d" || t === "box-front") return "cover";
    if (t === "sstitle" || t === "screenmarquee" || t === "screenmarqueesmall") return "title";
    if (t === "ss" || t === "screenshot") return "screenshot";
    return null;
  }

  private mapToScrapedGame(jeu: Record<string, unknown>): ScrapedGame {
    const id = getString(jeu, "id") || getString(jeu, "jeuid") || "";
    const name = pickJeuName(jeu) || "";
    const description = pickSynopsis(jeu, ["fr", "en"]) || undefined;
    const releaseDate = pickReleaseDate(jeu) || undefined;
    const genre = pickGenres(jeu, ["fr", "en"]) || undefined;
    const developer = getNestedText(jeu, "developpeur") || undefined;
    const publisher = getNestedText(jeu, "editeur") || undefined;
    const players = getNestedText(jeu, "joueurs", "text") || undefined;
    const rating = getNestedText(jeu, "note", "text") || undefined;
    const medias = Array.isArray((jeu as any).medias)
      ? ((jeu as any).medias as any[]).map(mapMediaSafe).filter(Boolean)
      : [];

    return {
      id,
      name,
      description,
      releaseDate,
      genre,
      developer,
      publisher,
      players,
      rating,
      media: medias as ScrapedMedia[],
    };
  }
}

type IdCarrier = {
  id?: string | number;
  jeuid?: string | number;
  idJeu?: string | number;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

async function parseJsonSafe(
  resp: Response,
  phase: "search" | "info",
): Promise<unknown | null> {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  // Clone before reading so we can always show body text on failure
  let bodyText = "";
  try {
    bodyText = await resp.clone().text();
  } catch {
    bodyText = "";
  }

  if (!ct.includes("application/json")) {
    console.error(
      `ScreenScraper ${phase} returned non-JSON (${ct}) Body:`,
      bodyText.slice(0, 300),
    );
    return null;
  }
  try {
    return JSON.parse(bodyText);
  } catch (e) {
    console.error(
      `ScreenScraper ${phase} JSON parse error:`,
      (e as Error).message,
      "Body:",
      bodyText.slice(0, 300),
    );
    return null;
  }
}

function hasHeaderError(
  data: unknown,
): data is { header: { erreur?: string } } & Record<string, unknown> {
  if (!isObject(data)) return false;
  const header = (data as Record<string, unknown>)["header"];
  if (!isObject(header)) return false;
  const err = header["erreur"];
  return typeof err === "string" && err.length > 0;
}

function getJeu(data: unknown): Record<string, unknown> | undefined {
  if (!isObject(data)) return undefined;
  const respVal = (data as Record<string, unknown>)["response"];
  if (!isObject(respVal)) return undefined;
  const jeuVal = respVal["jeu"];
  if (Array.isArray(jeuVal)) {
    const first = jeuVal[0];
    return isObject(first) ? (first as Record<string, unknown>) : undefined;
  }
  if (isObject(jeuVal)) return jeuVal as Record<string, unknown>;
  return undefined;
}

function coerceIdCarrier(o: Record<string, unknown>): IdCarrier {
  const out: IdCarrier = {};
  const id = o["id"];
  if (typeof id === "string" || typeof id === "number") out.id = id;
  const jeuid = o["jeuid"];
  if (typeof jeuid === "string" || typeof jeuid === "number") out.jeuid = jeuid;
  const idJeu = o["idJeu"];
  if (typeof idJeu === "string" || typeof idJeu === "number") out.idJeu = idJeu;
  return out;
}

function isShortRomName(name: string): boolean {
  const n = name.trim();
  if (n.includes(" ")) return false;
  if (n.length === 0) return false;
  if (n.length > 16) return false;
  return /^[a-z0-9._-]+$/i.test(n);
}

function redactUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const redactKeys = new Set(["ssid", "sspassword", "devid", "devpassword"]);
    for (const key of Array.from(u.searchParams.keys())) {
      if (redactKeys.has(key)) {
        u.searchParams.set(key, "***");
      }
    }
    return u.toString();
  } catch {
    return urlStr;
  }
}

// ===== Helpers to parse ScreenScraper structures =====
function getString(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
}

function getNestedText(
  o: Record<string, unknown>,
  key: string,
  subKey = "text",
): string | null {
  const v = o[key];
  if (typeof v === "string") return v;
  if (isObject(v)) {
    const t = (v as Record<string, unknown>)[subKey];
    return typeof t === "string" ? t : null;
  }
  return null;
}

function pickJeuName(jeu: Record<string, unknown>): string | null {
  const noms = (jeu as any).noms;
  if (Array.isArray(noms)) {
    // prefer regions: ss, wor, eu, us, jp, else first
    const pref = ["ss", "wor", "eu", "us", "jp"];
    for (const region of pref) {
      const found = noms.find((n: any) => n && n.region === region && typeof n.text === "string");
      if (found) return found.text as string;
    }
    const first = noms.find((n: any) => typeof n?.text === "string");
    if (first) return first.text as string;
  }
  // fallback: try plain name fields
  return getString(jeu, "nom");
}

function pickSynopsis(
  jeu: Record<string, unknown>,
  langsPreferred: string[] = ["fr", "en"],
): string | null {
  const syns = (jeu as any).synopsis;
  if (Array.isArray(syns)) {
    for (const lang of langsPreferred) {
      const found = syns.find((s: any) => s && s.langue === lang && typeof s.text === "string");
      if (found) return found.text as string;
    }
    const first = syns.find((s: any) => typeof s?.text === "string");
    if (first) return first.text as string;
  }
  return null;
}

function pickReleaseDate(jeu: Record<string, unknown>): string | null {
  const dates = (jeu as any).dates;
  if (Array.isArray(dates)) {
    const order = ["wor", "eu", "us", "jp"];
    for (const region of order) {
      const found = dates.find((d: any) => d && d.region === region && typeof d.text === "string");
      if (found) return found.text as string;
    }
    const first = dates.find((d: any) => typeof d?.text === "string");
    if (first) return first.text as string;
  }
  return null;
}

function pickGenres(
  jeu: Record<string, unknown>,
  langsPreferred: string[] = ["fr", "en"],
): string | null {
  const genres = (jeu as any).genres;
  if (Array.isArray(genres)) {
    const names: string[] = [];
    // Prefer principale === "1"
    const prim = genres.filter((g: any) => g && (g.principale === "1" || g.principale === 1));
    const list = prim.length > 0 ? prim : genres;
    for (const g of list) {
      const noms = Array.isArray(g?.noms) ? g.noms : [];
      let added = false;
      for (const lang of langsPreferred) {
        const found = noms.find((n: any) => n && n.langue === lang && typeof n.text === "string");
        if (found) {
          names.push(found.text as string);
          added = true;
          break;
        }
      }
      if (!added) {
        const first = noms.find((n: any) => typeof n?.text === "string");
        if (first) names.push(first.text as string);
      }
    }
    if (names.length > 0) return Array.from(new Set(names)).join(" / ");
  }
  return null;
}

function mapMediaSafe(m: any): ScrapedMedia | null {
  if (!m || typeof m !== "object") return null;
  const type = typeof m.type === "string" ? m.type : null;
  const url = typeof m.url === "string" ? m.url : null;
  const format = typeof m.format === "string" ? m.format : "";
  if (!url) return null;
  return { type: type || "", url, format };
}
