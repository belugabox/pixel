import { BaseScraper } from "./base-scraper";
import {
  ScreenScraperScraper,
  ScreenScraperCredentials,
} from "./screenscraper";
import { IgdbScraper, IgdbCredentials } from "./igdb";

export type ScraperType = "screenscraper" | "igdb";

export interface ScraperFactoryConfig {
  screenscraper?: ScreenScraperCredentials;
  igdb?: IgdbCredentials;
  // Future scrapers can be added here
  // igdb?: IGDBCredentials;
  // moby?: MobyCredentials;
}

export class ScraperFactory {
  private static scrapers: Map<ScraperType, BaseScraper> = new Map();

  /**
   * Get a scraper instance
   */
  static getScraper(
    type: ScraperType,
    config?: ScraperFactoryConfig,
  ): BaseScraper {
    const existingScraper = this.scrapers.get(type);
    if (existingScraper) {
      return existingScraper;
    }

    let scraper: BaseScraper;

    switch (type) {
      case "screenscraper":
        scraper = new ScreenScraperScraper(config?.screenscraper);
        break;
      case "igdb":
        scraper = new IgdbScraper(config?.igdb);
        break;
      default:
        throw new Error(`Unknown scraper type: ${type}`);
    }

    this.scrapers.set(type, scraper);
    return scraper;
  }

  /**
   * Get all available scraper types
   */
  static getAvailableScrapers(): ScraperType[] {
    return ["screenscraper", "igdb"];
  }

  /**
   * Clear scraper cache (useful for updating credentials)
   */
  static clearCache(): void {
    this.scrapers.clear();
  }

  /**
   * Update scraper credentials (removes cached instance to force recreation)
   */
  static updateCredentials(type: ScraperType): void {
    this.scrapers.delete(type); // Remove cached instance to force recreation
  }
}
