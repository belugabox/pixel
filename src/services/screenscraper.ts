import { promises as fs } from 'node:fs';
import path from 'node:path';

// Types for ScreenScraper API responses
export interface ScreenScraperGame {
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

export interface ScreenScraperMedia {
  type: string;
  url: string;
  format: string;
}

export interface GameMetadata {
  id: string;
  name: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  players?: string;
  rating?: string;
  images: {
    cover?: string;
    screenshot?: string;
    title?: string;
  };
}

export class ScreenScraperService {
  private baseUrl = 'https://www.screenscraper.fr/api2';
  private userAgent = 'pixel-frontend/0.0.1';
  
  constructor(
    private devId?: string,
    private devPassword?: string,
    private softname?: string,
    private ssid?: string,
    private sspassword?: string
  ) {}

  /**
   * Search for a game by ROM filename and system
   */
  async searchGame(romFileName: string, systemId: string): Promise<ScreenScraperGame | null> {
    try {
      // Remove file extension and clean filename
      const cleanName = this.cleanRomName(romFileName);
      
      const params = new URLSearchParams({
        devid: this.devId || '',
        devpassword: this.devPassword || '',
        softname: this.softname || 'pixel-frontend',
        output: 'json',
        recherche: cleanName,
        systemeid: this.getSystemId(systemId) || systemId
      });

      // Add user credentials if available
      if (this.ssid && this.sspassword) {
        params.append('ssid', this.ssid);
        params.append('sspassword', this.sspassword);
      }

      const url = `${this.baseUrl}/jeuInfos.php?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        console.error(`ScreenScraper API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.response && data.response.jeu) {
        return data.response.jeu;
      }

      return null;
    } catch (error) {
      console.error('Error searching ScreenScraper:', error);
      return null;
    }
  }

  /**
   * Download and save game metadata including images
   */
  async downloadMetadata(
    romFileName: string, 
    systemId: string, 
    romsRoot: string
  ): Promise<GameMetadata | null> {
    try {
      const game = await this.searchGame(romFileName, systemId);
      if (!game) return null;

      const metadata: GameMetadata = {
        id: game.id,
        name: game.nom,
        description: game.description,
        releaseDate: game.date,
        genre: game.genre,
        developer: game.developer,
        publisher: game.publisher,
        players: game.players,
        rating: game.rating,
        images: {}
      };

      // Create metadata directory structure
      const metadataDir = path.join(path.dirname(romsRoot), 'metadata', systemId);
      await fs.mkdir(metadataDir, { recursive: true });

      // Download images if available
      if (game.medias && game.medias.length > 0) {
        for (const media of game.medias) {
          const imageType = this.getImageType(media.type);
          if (imageType) {
            const imagePath = await this.downloadImage(media.url, metadataDir, romFileName, imageType);
            if (imagePath) {
              metadata.images[imageType] = imagePath;
            }
          }
        }
      }

      // Save metadata JSON
      const metadataFile = path.join(metadataDir, `${path.parse(romFileName).name}.json`);
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

      return metadata;
    } catch (error) {
      console.error('Error downloading metadata:', error);
      return null;
    }
  }

  /**
   * Get cached metadata for a ROM
   */
  async getCachedMetadata(romFileName: string, systemId: string, romsRoot: string): Promise<GameMetadata | null> {
    try {
      const metadataDir = path.join(path.dirname(romsRoot), 'metadata', systemId);
      const metadataFile = path.join(metadataDir, `${path.parse(romFileName).name}.json`);
      
      const data = await fs.readFile(metadataFile, 'utf-8');
      return JSON.parse(data) as GameMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Check if metadata exists for a ROM
   */
  async hasMetadata(romFileName: string, systemId: string, romsRoot: string): Promise<boolean> {
    try {
      const metadataDir = path.join(path.dirname(romsRoot), 'metadata', systemId);
      const metadataFile = path.join(metadataDir, `${path.parse(romFileName).name}.json`);
      
      await fs.access(metadataFile);
      return true;
    } catch {
      return false;
    }
  }

  private cleanRomName(fileName: string): string {
    // Remove file extension
    let clean = path.parse(fileName).name;
    
    // Remove common ROM tags like (USA), [!], etc.
    clean = clean.replace(/\([^)]*\)/g, '');
    clean = clean.replace(/\[[^\]]*\]/g, '');
    clean = clean.replace(/\{[^}]*\}/g, '');
    
    // Clean up spaces and special characters
    clean = clean.trim().replace(/\s+/g, ' ');
    
    return clean;
  }

  private getSystemId(systemId: string): string | null {
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

  private getImageType(mediaType: string): keyof GameMetadata['images'] | null {
    const typeMap: Record<string, keyof GameMetadata['images']> = {
      'box-2D': 'cover',
      'box-front': 'cover',
      'screenmarquee': 'title',
      'ss': 'screenshot',
      'screenshot': 'screenshot'
    };

    return typeMap[mediaType] || null;
  }

  private async downloadImage(
    url: string, 
    metadataDir: string, 
    romFileName: string, 
    imageType: string
  ): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) return null;

      const buffer = await response.arrayBuffer();
      const extension = this.getImageExtension(response.headers.get('content-type') || '');
      const imageName = `${path.parse(romFileName).name}_${imageType}${extension}`;
      const imagePath = path.join(metadataDir, imageName);

      await fs.writeFile(imagePath, Buffer.from(buffer));
      return imagePath;
    } catch (error) {
      console.error('Error downloading image:', error);
      return null;
    }
  }

  private getImageExtension(contentType: string): string {
    switch (contentType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/gif':
        return '.gif';
      case 'image/webp':
        return '.webp';
      default:
        return '.jpg';
    }
  }
}