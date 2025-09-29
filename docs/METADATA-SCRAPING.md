# Metadata Scraping Architecture

Ce document décrit l'architecture générique de scraping de métadonnées pour les ROMs, avec l'intégration de ScreenScraper.fr comme scraper principal.

## Architecture générique

L'application utilise une architecture modulaire permettant de supporter plusieurs scrapers :

- **BaseScraper** : Classe abstraite définissant l'interface commune
- **ScraperFactory** : Factory pour instancier et gérer les scrapers
- **MetadataService** : Service principal orchestrant les opérations de métadonnées

Cette architecture permet d'ajouter facilement d'autres scrapers (IGDB, MobyGames, etc.) sans modifier le code existant.

## Configuration

Pour utiliser ScreenScraper, vous devez configurer vos identifiants dans les paramètres de l'application :

1. Ouvrir les paramètres (Échap ou bouton ⚙️)
2. Remplir la section "Configuration ScreenScraper" :

La configuration est stockée dans le fichier `config.json` sous la structure suivante :

Pour IGDB, fournissez votre `Client ID` et `Client Secret` (Twitch). L'application récupère automatiquement un jeton via le flux `client_credentials`.

Configuration côté `config.json` :

```json
{
  "scrapers": {
    "igdb": {
      "clientId": "votre_client_id",
      "clientSecret": "votre_client_secret"
    }
  }
}
```

```json
{
  "scrapers": {
    "screenscraper": {
      "ssid": "votre_nom_utilisateur",
      "sspassword": "votre_mot_de_passe",
      "devid": "",
      "devpassword": "",
      "softname": "pixel"
    }
  }
}
```

## Structure des métadonnées

Les métadonnées sont stockées dans un dossier `metadata` au même niveau que le dossier `roms`, avec la même structure :

```
app/
├── roms/
│   ├── neogeo/
│   │   ├── Metal Slug.zip
│   │   └── King of Fighters 98.zip
│   └── snes/
│       ├── Super Mario World.smc
│       └── Zelda - A Link to the Past.smc
└── metadata/
    ├── neogeo/
    │   ├── Metal Slug.json
    │   ├── Metal Slug_cover.jpg
    │   └── Metal Slug_screenshot.jpg
    └── snes/
        ├── Super Mario World.json
        ├── Super Mario World_cover.jpg
        └── Super Mario World_title.jpg
```

## Format des métadonnées

Chaque ROM a un fichier `.json` correspondant contenant :

```json
{
  "id": "1234",
  "name": "Metal Slug",
  "description": "Run and gun arcade game featuring intense action gameplay.",
  "releaseDate": "1996",
  "genre": "Action/Shooter",
  "developer": "Nazca Corporation",
  "publisher": "SNK",
  "players": "1-2",
  "rating": "9/10",
  "images": {
    "cover": "/path/to/Metal Slug_cover.jpg",
    "screenshot": "/path/to/Metal Slug_screenshot.jpg",
    "title": "/path/to/Metal Slug_title.jpg"
  }
}
```

## Types d'images supportées

- **cover** : Jaquette du jeu
- **screenshot** : Capture d'écran du jeu
- **title** : Écran titre du jeu

## Utilisation

### Téléchargement individuel

Sur l'écran des ROMs, chaque ROM sans métadonnée affiche un bouton "Télécharger métadonnées".

### Téléchargement en lot

Un bouton "Télécharger toutes les métadonnées" permet de télécharger les métadonnées pour tous les ROMs d'un système en une fois.

## Mapping des systèmes (ScreenScraper)

Les systèmes sont mappés vers les IDs ScreenScraper suivants :

- `neogeo` → `142`
- `snes` → `4`
- `model2` → `32`
- `nes` → `3`
- `gameboy` → `9`
- `gba` → `12`
- `genesis` → `1`
- `mastersystem` → `2`
- `psx` → `57`
- `ps2` → `58`
- `n64` → `14`
- `gamecube` → `13`

## Gestion des erreurs

- Rate limiting : L'API applique un délai de 1 seconde entre les requêtes
- Erreurs réseau : Gérées gracieusement avec des logs
- Métadonnées manquantes : Les ROMs sans métadonnées sont marquées visuellement
- Cache : Les métadonnées existantes ne sont pas re-téléchargées

## Architecture technique

### Services

- `MetadataService` : Service principal pour les opérations de métadonnées
- `ScraperFactory` : Factory pour la gestion des scrapers
- `BaseScraper` : Classe de base abstraite pour tous les scrapers
- `ScreenScraperScraper` : Implémentation spécifique pour ScreenScraper.fr

### Extension

Pour ajouter un nouveau scraper :

1. Créer une classe héritant de `BaseScraper`
2. Implémenter les méthodes abstraites
3. Ajouter le scraper au `ScraperFactory`
4. Étendre les types de configuration si nécessaire

### API ScreenScraper

L'intégration utilise l'API v2 de ScreenScraper.fr :

- Recherche : `https://api.screenscraper.fr/api2/jeuRecherche.php`
- Détails par jeu : `https://api.screenscraper.fr/api2/jeuInfos.php`
- Format : JSON
- Recherche par nom (paramètre `recherche`) avec `systemeid`, puis récupération détaillée par `gameid` (et `systemeid`).
- Support des identifiants développeur et utilisateur (`ssid`/`sspassword`, `devid`/`devpassword`, `softname`)

### Dépannage (erreur 400)

- Vérifiez que `softname` est fourni (défaut: `pixel`).
- Si possible, renseignez `devid` et `devpassword` pour un accès plus fiable.
- Assurez-vous que `ssid` et `sspassword` sont corrects et non vides.
- L'API nécessite un `User-Agent` et respecte un délai entre requêtes (géré par l'appli).
