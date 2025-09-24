import { useEffect, useState } from 'react';
import type { UserConfig } from '../types';

export function useUserConfig() {
  const [cfg, setCfg] = useState<UserConfig | null>(null);

  const refresh = async () => {
    const c = await window.config.get();
    setCfg(c);
  };

  useEffect(() => { void refresh(); }, []);

  const save = async (next: UserConfig) => {
    await window.config.set(next);
    await refresh();
  };

  return { cfg, save, refresh } as const;
}
