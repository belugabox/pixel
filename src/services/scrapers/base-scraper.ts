import { promises as fs } from "node:fs";
import path from "node:path";
import { GameMetadata, ScrapedGame, ScraperConfig, ImageType } from "./types";
import { app } from "electron";

export abstract class BaseScraper {
  protected abstract readonly name: string;
  protected abstract readonly userAgent: string;

  constructor(protected config: ScraperConfig = {}) {}

  /**
   * Search for a game by ROM filename and system
   */
  abstract searchGame(
    romFileName: string,
    systemId: string,
  ): Promise<ScrapedGame | null>;

  /**
   * Get the system ID mapping for this scraper
   */
  protected abstract getSystemId(systemId: string): string | null;

  /**
   * Map media type to our internal image type
   */
  protected abstract getImageType(mediaType: string): ImageType | null;

  /**
   * Download and save game metadata including images
   */
  async downloadMetadata(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<GameMetadata | null> {
    void romsRoot;
    try {
      const game = await this.searchGame(romFileName, systemId);
      if (!game) return null;

      const metadata: GameMetadata = {
        id: game.id,
        name: game.name,
        description: game.description,
        releaseDate: game.releaseDate,
        genre: game.genre,
        developer: game.developer,
        publisher: game.publisher,
        players: game.players,
        rating: game.rating,
        images: {},
      };

      // Create metadata directory structure at application data root
      const metadataDir = path.join(
        app.getPath("userData"),
        "metadata",
        systemId,
      );
      await fs.mkdir(metadataDir, { recursive: true });

      // Download images if available
      if (game.media && game.media.length > 0) {
        for (const media of game.media) {
          const imageType = this.getImageType(media.type);
          if (imageType) {
            const imagePath = await this.downloadImage(
              media.url,
              metadataDir,
              romFileName,
              imageType,
            );
            if (imagePath) {
              metadata.images[imageType] = imagePath;
            }
          }
        }
      }

      // Save metadata JSON
      const metadataFile = path.join(
        metadataDir,
        `${path.parse(romFileName).name}.json`,
      );
      await fs.writeFile(
        metadataFile,
        JSON.stringify(metadata, null, 2),
        "utf-8",
      );

      return metadata;
    } catch (error) {
      console.error(`Error downloading metadata with ${this.name}:`, error);
      return null;
    }
  }

  /**
   * Get cached metadata for a ROM
   */
  async getCachedMetadata(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<GameMetadata | null> {
    void romsRoot;
    try {
      const metadataDir = path.join(
        app.getPath("userData"),
        "metadata",
        systemId,
      );
      const metadataFile = path.join(
        metadataDir,
        `${path.parse(romFileName).name}.json`,
      );

      const data = await fs.readFile(metadataFile, "utf-8");
      return JSON.parse(data) as GameMetadata;
    } catch {
      return null;
    }
  }

  /**
   * Check if metadata exists for a ROM
   */
  async hasMetadata(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<boolean> {
    void romsRoot;
    try {
      const metadataDir = path.join(
        app.getPath("userData"),
        "metadata",
        systemId,
      );
      const metadataFile = path.join(
        metadataDir,
        `${path.parse(romFileName).name}.json`,
      );

      await fs.access(metadataFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download metadata for all ROMs in a system
   */
  async downloadSystemMetadata(
    systemId: string,
    romsRoot: string,
    onProgress?: (current: number, total: number, fileName: string) => void,
  ): Promise<void> {
    try {
      const { promises: fs } = await import("node:fs");
      const pathModule = await import("node:path");

      // Get list of ROM files for this system
      const systemDir = pathModule.join(romsRoot, systemId);
      const entries = await fs.readdir(systemDir, { withFileTypes: true });
      const romFiles = entries.filter((e) => e.isFile()).map((e) => e.name);

      let current = 0;
      for (const romFile of romFiles) {
        current++;
        onProgress?.(current, romFiles.length, romFile);

        // Skip if metadata already exists
        const hasExisting = await this.hasMetadata(romFile, systemId, romsRoot);
        if (hasExisting) {
          continue;
        }

        // Download metadata with a small delay to avoid rate limiting
        await this.downloadMetadata(romFile, systemId, romsRoot);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    } catch (error) {
      console.error(
        `Error downloading system metadata with ${this.name}:`,
        error,
      );
    }
  }

  /**
   * Clean ROM filename for searching
   */
  protected cleanRomName(fileName: string): string {
    // Remove file extension
    let clean = path.parse(fileName).name;

    // Remove common ROM tags like (USA), [!], etc.
    clean = clean.replace(/\([^)]*\)/g, "");
    clean = clean.replace(/\[[^\]]*\]/g, "");
    clean = clean.replace(/\{[^}]*\}/g, "");

    // Clean up spaces and special characters
    clean = clean.trim().replace(/\s+/g, " ");

    return clean;
  }

  /**
   * Download an image and save it locally
   */
  protected async downloadImage(
    url: string,
    metadataDir: string,
    romFileName: string,
    imageType: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) return null;

      const buffer = await response.arrayBuffer();
      const extension = this.getImageExtension(
        response.headers.get("content-type") || "",
      );
      const imageName = `${path.parse(romFileName).name}_${imageType}${extension}`;
      const imagePath = path.join(metadataDir, imageName);

      await fs.writeFile(imagePath, Buffer.from(buffer));
      return imagePath;
    } catch (error) {
      console.error(`Error downloading image with ${this.name}:`, error);
      return null;
    }
  }

  /**
   * Get file extension from content type
   */
  protected getImageExtension(contentType: string): string {
    switch (contentType) {
      case "image/jpeg":
        return ".jpg";
      case "image/png":
        return ".png";
      case "image/gif":
        return ".gif";
      case "image/webp":
        return ".webp";
      default:
        return ".jpg";
    }
  }
}
