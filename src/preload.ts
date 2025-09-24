import { contextBridge, ipcRenderer } from 'electron';

type UserConfig = {
	romsRoot: string;
	emulatorsRoot: string;
	toolsRoot?: string;
};

type Emulator = {
	id: string;
	name: string;
	path: string;
	args?: string[];
	coresPath?: string;
};

type System = {
	id: string;
	name: string;
	extensions: string[];
	emulator: string;
	core: string;
};

type Catalog = {
	emulators: Emulator[];
	systems: System[];
};

contextBridge.exposeInMainWorld('config', {
	get: async (): Promise<UserConfig> => ipcRenderer.invoke('config:get'),
	set: async (cfg: UserConfig): Promise<UserConfig> => ipcRenderer.invoke('config:set', cfg),
});

contextBridge.exposeInMainWorld('catalog', {
	get: async (): Promise<Catalog> => ipcRenderer.invoke('catalog:get'),
});

contextBridge.exposeInMainWorld('roms', {
	list: async (): Promise<string[]> => ipcRenderer.invoke('roms:list'),
});

contextBridge.exposeInMainWorld('dialog', {
	selectDirectory: async (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
});

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
