# ScreenScraper Integration

Ce document décrit l'intégration de l'API ScreenScraper.fr pour récupérer les métadonnées des ROMs.

## Configuration

Pour utiliser ScreenScraper, vous devez configurer vos identifiants dans les paramètres de l'application :

1. Ouvrir les paramètres (Échap ou bouton ⚙️)
2. Remplir la section "Configuration ScreenScraper" :
   - **Dev ID** et **Dev Password** : Identifiants développeur (optionnels mais recommandés)
   - **Nom d'utilisateur** et **Mot de passe** : Vos identifiants ScreenScraper.fr

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

## Mapping des systèmes

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

## API ScreenScraper

L'intégration utilise l'API v2 de ScreenScraper.fr :
- Endpoint : `https://www.screenscraper.fr/api2/jeuInfos.php`
- Format : JSON
- Recherche par nom de fichier ROM nettoyé
- Support des identifiants développeur et utilisateur