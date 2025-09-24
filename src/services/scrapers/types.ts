// Generic types for metadata scraping

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

export interface ScrapedGame {
  id: string;
  name: string;
  description?: string;
  releaseDate?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  players?: string;
  rating?: string;
  media?: ScrapedMedia[];
}

export interface ScrapedMedia {
  type: string;
  url: string;
  format: string;
}

export interface ScraperConfig {
  [key: string]: string | number | boolean | undefined;
}

export type ImageType = 'cover' | 'screenshot' | 'title';

export interface ScraperCredentials {
  [key: string]: string | undefined;
}