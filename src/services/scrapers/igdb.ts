import { BaseScraper } from "./base-scraper";
import { ImageType, ScrapedGame, ScrapedMedia } from "./types";

export interface IgdbCredentials {
  clientId?: string;
  clientSecret?: string;
}

interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  genres?: Array<{ name: string }>;
  involved_companies?: Array<{
    company?: { name?: string };
    developer?: boolean;
    publisher?: boolean;
  }>;
  total_rating?: number;
  rating?: number;
  cover?: { image_id: string };
  screenshots?: Array<{ image_id: string }>;
}

export class IgdbScraper extends BaseScraper {
  protected readonly name = "IGDB";
  protected readonly userAgent = "pixel-frontend/0.0.1";

  private token: string | undefined;
  private tokenExpiry: number | undefined; // epoch seconds

  constructor(private creds: IgdbCredentials = {}) {
    super({});
  }

  protected getSystemId(systemId: string): string | null {
    void systemId; // not used for IGDB basic search
    return null;
  }

  protected getImageType(mediaType: string): ImageType | null {
    const map: Record<string, ImageType> = {
      cover: "cover",
      screenshot: "screenshot",
    };
    return map[mediaType] ?? null;
  }

  async searchGame(
    romFileName: string,
    _systemId: string,
  ): Promise<ScrapedGame | null> {
    try {
      void _systemId;
      const cleanName = this.cleanRomName(romFileName);
      const ok = await this.ensureToken();
      if (!ok) return null;
      if (!this.creds.clientId) {
        console.error("IGDB requires a Client-ID");
        return null;
      }

      const query = [
        `search "${escapeQuotes(cleanName)}";`,
        "fields id,name,summary,storyline,first_release_date,genres.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,cover.image_id,screenshots.image_id,total_rating,rating;",
        "limit 1;",
      ].join(" ");

      const igdbUrl = "https://api.igdb.com/v4/games";
      console.log(`[IGDB] POST ${igdbUrl} Body:`, query.slice(0, 120).replace(/\s+/g, ' ') + (query.length > 120 ? '…' : ''));
      const resp = await fetch(igdbUrl, {
        method: "POST",
        headers: {
          "Client-ID": this.creds.clientId,
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Content-Type": "text/plain",
          "User-Agent": this.userAgent,
        },
        body: query,
      });

      if (!resp.ok) {
        const body = await safeReadText(resp);
        console.error(`IGDB API error ${resp.status}:`, body.slice(0, 300));
        return null;
      }

      const data = (await resp.json()) as IgdbGame[];
      if (!Array.isArray(data) || data.length === 0) return null;

      return this.mapToScrapedGame(data[0]);
    } catch (e) {
      console.error("Error searching IGDB:", e);
      return null;
    }
  }

  private mapToScrapedGame(game: IgdbGame): ScrapedGame {
    const developer = game.involved_companies?.find((ic) => ic.developer)
      ?.company?.name;
    const publisher = game.involved_companies?.find((ic) => ic.publisher)
      ?.company?.name;
    const genre =
      game.genres
        ?.map((g) => g.name)
        .filter(Boolean)
        .join("/") || undefined;
    const releaseDate = game.first_release_date
      ? new Date(game.first_release_date * 1000).getFullYear().toString()
      : undefined;

    const media: ScrapedMedia[] = [];
    if (game.cover?.image_id) {
      media.push({
        type: "cover",
        url: igdbImageUrl(game.cover.image_id, "t_cover_big"),
        format: "jpg",
      });
    }
    if (game.screenshots && game.screenshots.length > 0) {
      // take first screenshot
      const first = game.screenshots[0];
      if (first.image_id)
        media.push({
          type: "screenshot",
          url: igdbImageUrl(first.image_id, "t_screenshot_big"),
          format: "jpg",
        });
    }

    return {
      id: String(game.id),
      name: game.name,
      description: game.summary || game.storyline,
      releaseDate,
      genre,
      developer,
      publisher,
      rating: (game.total_rating ?? game.rating)?.toFixed
        ? String(Math.round((game.total_rating ?? game.rating) as number))
        : undefined,
      media,
    };
  }

  private async ensureToken(): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.tokenExpiry && this.tokenExpiry - 60 > now)
      return true;

    if (this.creds.clientId && this.creds.clientSecret) {
      try {
        const url = new URL("https://id.twitch.tv/oauth2/token");
        url.searchParams.set("client_id", this.creds.clientId);
        url.searchParams.set("client_secret", this.creds.clientSecret);
        url.searchParams.set("grant_type", "client_credentials");

        console.log(`[IGDB] POST ${url.origin}${url.pathname}?client_id=***&client_secret=***&grant_type=client_credentials`);

        const resp = await fetch(url.toString(), { method: "POST" });
        if (!resp.ok) {
          const body = await resp.text();
          console.error(
            "IGDB token fetch failed:",
            resp.status,
            body.slice(0, 200),
          );
          return false;
        }
        const tok = (await resp.json()) as {
          access_token: string;
          expires_in: number;
        };
        this.token = tok.access_token;
        this.tokenExpiry = now + (tok.expires_in || 0);
        return true;
      } catch (e) {
        console.error("IGDB token error:", e);
        return false;
      }
    }

    console.error("IGDB token unavailable: provide clientId+clientSecret");
    return false;
  }
}

function igdbImageUrl(imageId: string, size: string): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
