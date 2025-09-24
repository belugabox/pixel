export type UserConfig = {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
};

export type View = { name: 'systems' } | { name: 'roms'; system: string };
