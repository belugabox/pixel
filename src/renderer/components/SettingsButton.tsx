import React from 'react';

export function SettingsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button id="settings-btn" className="settings-btn" title="Paramètres" aria-label="Paramètres" onClick={onOpen}>⚙️</button>
  );
}
