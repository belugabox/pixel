import {
  ScraperFactory,
  ScraperType,
  ScraperFactoryConfig,
} from "./scrapers/scraper-factory";
import { GameMetadata } from "./scrapers/types";

export class MetadataService {
  private defaultScraper: ScraperType = "igdb";

  constructor(private config: ScraperFactoryConfig = {}) {}

  /**
   * Get metadata for a ROM using the default scraper
   */
  async getMetadata(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<GameMetadata | null> {
    const scraper = ScraperFactory.getScraper(this.defaultScraper, this.config);
    return scraper.getCachedMetadata(romFileName, systemId, romsRoot);
  }

  /**
   * Download metadata for a ROM using the default scraper
   */
  async downloadMetadata(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<GameMetadata | null> {
    const scraper = ScraperFactory.getScraper(this.defaultScraper, this.config);
    return scraper.downloadMetadata(romFileName, systemId, romsRoot);
  }

  /**
   * Check if metadata exists for a ROM
   */
  async hasMetadata(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<boolean> {
    const scraper = ScraperFactory.getScraper(this.defaultScraper, this.config);
    return scraper.hasMetadata(romFileName, systemId, romsRoot);
  }

  /**
   * Download metadata for all ROMs in a system using the default scraper
   */
  async downloadSystemMetadata(
    systemId: string,
    romsRoot: string,
    onProgress?: (current: number, total: number, fileName: string) => void,
  ): Promise<void> {
    const scraper = ScraperFactory.getScraper(this.defaultScraper, this.config);
    return scraper.downloadSystemMetadata(systemId, romsRoot, onProgress);
  }

  /**
   * Set the default scraper to use
   */
  setDefaultScraper(scraperType: ScraperType): void {
    this.defaultScraper = scraperType;
  }

  /**
   * Get the current default scraper
   */
  getDefaultScraper(): ScraperType {
    return this.defaultScraper;
  }

  /**
   * Get all available scrapers
   */
  getAvailableScrapers(): ScraperType[] {
    return ScraperFactory.getAvailableScrapers();
  }

  /**
   * Update scraper configuration
   */
  updateConfig(config: ScraperFactoryConfig): void {
    this.config = { ...this.config, ...config };
    ScraperFactory.clearCache(); // Clear cache to use new config
  }

  /**
   * Try multiple scrapers if the default fails
   */
  async downloadMetadataWithFallback(
    romFileName: string,
    systemId: string,
    romsRoot: string,
  ): Promise<GameMetadata | null> {
    const availableScrapers = this.getAvailableScrapers();

    // Try default scraper first
    const defaultResult = await this.downloadMetadata(
      romFileName,
      systemId,
      romsRoot,
    );
    if (defaultResult) {
      return defaultResult;
    }

    // Try other scrapers as fallback
    for (const scraperType of availableScrapers) {
      if (scraperType === this.defaultScraper) continue; // Already tried

      const scraper = ScraperFactory.getScraper(scraperType, this.config);
      const result = await scraper.downloadMetadata(
        romFileName,
        systemId,
        romsRoot,
      );
      if (result) {
        return result;
      }
    }

    return null;
  }
}
