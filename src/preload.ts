import { contextBridge, ipcRenderer } from 'electron';

type Theme = 'default' | 'light' | 'dark';

type UserConfig = {
	theme: Theme;
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

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
