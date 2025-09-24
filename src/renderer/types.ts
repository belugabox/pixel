export type UserConfig = {
  romsRoot: string;
  emulatorsRoot: string;
  toolsRoot?: string;
  screenscraper?: {
    devId?: string;
    devPassword?: string;
    softname?: string;
    ssid?: string;
    sspassword?: string;
  };
};

export type View = { name: 'systems' } | { name: 'roms'; system: string };
