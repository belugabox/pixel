import { BaseScraper } from './base-scraper';
import { ScrapedGame, ScrapedMedia, ImageType, ScraperCredentials } from './types';

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
  devId?: string;
  devPassword?: string;
  softname?: string;
  ssid?: string;
  sspassword?: string;
}

export class ScreenScraperScraper extends BaseScraper {
  protected readonly name = 'ScreenScraper';
  protected readonly userAgent = 'pixel-frontend/0.0.1';
  private readonly baseUrl = 'https://www.screenscraper.fr/api2';

  constructor(private credentials: ScreenScraperCredentials = {}) {
    super(credentials);
  }

  async searchGame(romFileName: string, systemId: string): Promise<ScrapedGame | null> {
    try {
      // Remove file extension and clean filename
      const cleanName = this.cleanRomName(romFileName);
      
      const params = new URLSearchParams({
        devid: this.credentials.devId || '',
        devpassword: this.credentials.devPassword || '',
        softname: this.credentials.softname || 'pixel-frontend',
        output: 'json',
        recherche: cleanName,
        systemeid: this.getSystemId(systemId) || systemId
      });

      // Add user credentials if available
      if (this.credentials.ssid && this.credentials.sspassword) {
        params.append('ssid', this.credentials.ssid);
        params.append('sspassword', this.credentials.sspassword);
      }

      const url = `${this.baseUrl}/jeuInfos.php?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('ScreenScraper API rate limit exceeded');
          return null;
        }
        console.error(`ScreenScraper API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      // Handle API errors
      if (data.header?.erreur) {
        console.error('ScreenScraper API error:', data.header.erreur);
        return null;
      }
      
      if (data.response && data.response.jeu) {
        return this.mapToScrapedGame(data.response.jeu);
      }

      return null;
    } catch (error) {
      console.error('Error searching ScreenScraper:', error);
      return null;
    }
  }

  protected getSystemId(systemId: string): string | null {
    // Map internal system IDs to ScreenScraper system IDs
    const systemMap: Record<string, string> = {
      'neogeo': '142',
      'snes': '4',
      'model2': '32', // Sega Model 2
      'nes': '3',
      'gameboy': '9',
      'gba': '12',
      'genesis': '1',
      'mastersystem': '2',
      'psx': '57',
      'ps2': '58',
      'n64': '14',
      'gamecube': '13'
    };

    return systemMap[systemId.toLowerCase()] || null;
  }

  protected getImageType(mediaType: string): ImageType | null {
    const typeMap: Record<string, ImageType> = {
      'box-2D': 'cover',
      'box-front': 'cover',
      'screenmarquee': 'title',
      'ss': 'screenshot',
      'screenshot': 'screenshot'
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
      media: game.medias?.map(this.mapToScrapedMedia) || []
    };
  }

  private mapToScrapedMedia(media: ScreenScraperMedia): ScrapedMedia {
    return {
      type: media.type,
      url: media.url,
      format: media.format
    };
  }
}