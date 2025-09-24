import { BaseScraper } from "./base-scraper";
import {
  ScrapedGame,
  ScrapedMedia,
  ImageType,
  ScraperCredentials,
} from "./types";

// ScreenScraper specific types
interface ScreenScraperGame {
  id: string;
  nom: string;
  description?: string;
  date?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  players?: string;
  rating?: string;
  medias?: ScreenScraperMedia[];
}

interface ScreenScraperMedia {
  type: string;
  url: string;
  format: string;
}

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
  private readonly baseUrl = "https://www.screenscraper.fr/api2";

  constructor(private credentials: ScreenScraperCredentials = {}) {
    super(credentials);
  }

  async searchGame(
    romFileName: string,
    systemId: string,
  ): Promise<ScrapedGame | null> {
    try {
      // Remove file extension and clean filename
      const cleanName = this.cleanRomName(romFileName);
      const sysInput =
        typeof systemId === "string" ? systemId.trim() : systemId;
      const systeme = this.getSystemId(sysInput) || sysInput;

      // Step 1: search by name to get the game id
      const searchParams = new URLSearchParams({
        output: "json",
        systemeid: systeme,
        langue: "fr",
      });
      if (isShortRomName(cleanName)) {
        searchParams.set("romnom", cleanName);
      } else {
        searchParams.set("recherche", cleanName);
      }
      this.appendAuthParams(searchParams);

      const searchUrl = `${this.baseUrl}/jeuRecherche.php?${searchParams.toString()}`;
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

      const first = this.pickFirstSearchResult(searchData);
      const idCandidate = first?.id ?? first?.jeuid ?? first?.idJeu;
      const jeuid = idCandidate != null ? String(idCandidate) : undefined;
      if (!jeuid) {
        return null;
      }

      // Step 2: fetch details by jeuid
      const infoParams = new URLSearchParams({
        output: "json",
        jeuid: String(jeuid),
      });
      this.appendAuthParams(infoParams);
      const infoUrl = `${this.baseUrl}/jeuInfos.php?${infoParams.toString()}`;
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
        return this.mapToScrapedGame(jeu as ScreenScraperGame);
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
    // Map internal system IDs to ScreenScraper system IDs
    const systemMap: Record<string, string> = {
      neogeo: "142",
      snes: "4",
      model2: "32", // Sega Model 2
      nes: "3",
      gameboy: "9",
      gba: "12",
      genesis: "1",
      mastersystem: "2",
      psx: "57",
      ps2: "58",
      n64: "14",
      gamecube: "13",
    };

    return systemMap[systemId.toLowerCase()] || null;
  }

  protected getImageType(mediaType: string): ImageType | null {
    const typeMap: Record<string, ImageType> = {
      "box-2D": "cover",
      "box-front": "cover",
      screenmarquee: "title",
      ss: "screenshot",
      screenshot: "screenshot",
    };

    return typeMap[mediaType] || null;
  }

  private mapToScrapedGame(game: ScreenScraperGame): ScrapedGame {
    return {
      id: game.id,
      name: game.nom,
      description: game.description,
      releaseDate: game.date,
      genre: game.genre,
      developer: game.developer,
      publisher: game.publisher,
      players: game.players,
      rating: game.rating,
      media: game.medias?.map(this.mapToScrapedMedia) || [],
    };
  }

  private mapToScrapedMedia(media: ScreenScraperMedia): ScrapedMedia {
    return {
      type: media.type,
      url: media.url,
      format: media.format,
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

function getJeu(data: unknown): ScreenScraperGame | undefined {
  if (!isObject(data)) return undefined;
  const respVal = (data as Record<string, unknown>)["response"];
  if (!isObject(respVal)) return undefined;
  const jeuVal = respVal["jeu"];
  if (Array.isArray(jeuVal)) {
    const first = jeuVal[0];
    return isObject(first)
      ? (first as unknown as ScreenScraperGame)
      : undefined;
  }
  if (isObject(jeuVal)) return jeuVal as unknown as ScreenScraperGame;
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
