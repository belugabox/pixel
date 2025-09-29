import { promises as fs } from "node:fs";
import path from "node:path";
import {
  GameMetadata,
  ScrapedGame,
  ScraperConfig,
  ImageType,
  SystemDownloadResult,
} from "./types";
import { app } from "electron";
import { shouldExclude } from "../../utils/exclude";

export abstract class BaseScraper {
  protected abstract readonly name: string;
  protected abstract readonly userAgent: string;

  constructor(protected config: ScraperConfig = {}) { }

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
   * Map media type to a video subtype (e.g., 'normalized')
   * Default: no video support; scrapers can override.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getVideoType(mediaType: string): 'normalized' | null { return null; }

  /**
   * Optional quality priority for images of the same ImageType.
   * Higher number wins. Default 0 (no preference).
   * Scrapers can override to prefer HD variants (e.g., ScreenScraper 'wheel-hd').
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getImageQualityPriority(imageType: ImageType, mediaType: string, format?: string): number {
    void imageType; void mediaType; void format; return 0;
  }

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

      // Download images/videos if available
      if (game.media && game.media.length > 0) {
        // First pass: pick best image per type based on quality
        const bestImages: Partial<Record<ImageType, { url: string; mediaType: string; score: number; format?: string }>> = {};
        for (const media of game.media) {
          const imageType = this.getImageType(media.type);
          if (imageType) {
            const score = this.getImageQualityPriority(imageType, media.type, media.format);
            const current = bestImages[imageType];
            if (!current || score > current.score) {
              bestImages[imageType] = { url: media.url, mediaType: media.type, score, format: media.format };
            }
            continue;
          }
        }
        // Second pass: download selected images
        for (const [imgType, selected] of Object.entries(bestImages) as Array<[ImageType, { url: string; mediaType: string; score: number; format?: string }]>) {
          try {
            const imagePath = await this.downloadImage(selected.url, metadataDir, romFileName, imgType);
            if (imagePath) {
              metadata.images[imgType] = imagePath;
            }
          } catch (e) {
            console.warn(`Failed to download image type ${imgType}:`, e);
          }
        }
        // Videos: handle individually (no selection logic yet)
        for (const media of game.media) {
          const videoType = this.getVideoType(media.type);
          if (videoType) {
            const videoPath = await this.downloadVideo(
              media.url,
              metadataDir,
              romFileName,
              videoType,
            );
            if (videoPath) {
              metadata.videos = metadata.videos || {};
              if (videoType === 'normalized') metadata.videos.normalized = videoPath;
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
    opts?: { force?: boolean; exclude?: string[] },
  ): Promise<SystemDownloadResult> {
    try {
      const { promises: fs } = await import("node:fs");
      const pathModule = await import("node:path");

      // Get list of ROM files for this system
      const systemDir = pathModule.join(romsRoot, systemId);
      const entries = await fs.readdir(systemDir, { withFileTypes: true });
      let romFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
      // Apply exclude filters from opts (case-insensitive, wildcards, basename)
      const before = romFiles.slice();
      if (opts?.exclude && opts.exclude.length > 0) {
        romFiles = romFiles.filter((name) => !shouldExclude(name, opts.exclude));
        const excluded = before.filter((n) => !romFiles.includes(n));
        if (excluded.length > 0) {
          console.log(
            `[scraper] Exclude applied for system '${systemId}': ${excluded.length} file(s) ignored ->`,
            excluded.slice(0, 10),
          );
        }
      }

      let current = 0;
      const result: SystemDownloadResult = {
        systemId,
        processed: romFiles.length,
        created: 0,
        skipped: 0,
        failed: 0,
        items: [],
      };
      for (const romFile of romFiles) {
        current++;
        onProgress?.(current, romFiles.length, romFile);

        // Skip if metadata already exists unless forcing re-scrape
        if (!opts?.force) {
          const hasExisting = await this.hasMetadata(
            romFile,
            systemId,
            romsRoot,
          );
          if (hasExisting) {
            result.skipped++;
            result.items.push({ fileName: romFile, status: "skipped" });
            continue;
          }
        }

        // Download metadata with a small delay to avoid rate limiting
        try {
          const md = await this.downloadMetadata(romFile, systemId, romsRoot);
          if (md) {
            result.created++;
            result.items.push({ fileName: romFile, status: "created", metadata: md });
          } else {
            result.failed++;
            result.items.push({ fileName: romFile, status: "failed" });
          }
        } catch (e) {
          console.error("downloadMetadata error:", e);
          result.failed++;
          result.items.push({ fileName: romFile, status: "failed" });
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
      return result;
    } catch (error) {
      console.error(
        `Error downloading system metadata with ${this.name}:`,
        error,
      );
      return {
        systemId,
        processed: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        items: [],
      };
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

  /**
   * Download a video (or generic binary) and save it locally
   */
  protected async downloadVideo(
    url: string,
    metadataDir: string,
    romFileName: string,
    subtype: 'normalized',
  ): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const ct = (response.headers.get('content-type') || '').toLowerCase();
      let ext = '.mp4';
      if (ct.includes('webm')) ext = '.webm';
      else if (ct.includes('ogg')) ext = '.ogg';
      else if (ct.includes('x-matroska') || ct.includes('matroska') || ct.includes('mkv')) ext = '.mkv';
      const fileName = `${path.parse(romFileName).name}_video-${subtype}${ext}`;
      const filePath = path.join(metadataDir, fileName);
      await fs.writeFile(filePath, Buffer.from(buffer));
      return filePath;
    } catch (error) {
      console.error(`Error downloading video with ${this.name}:`, error);
      return null;
    }
  }
}
