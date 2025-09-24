import React from 'react';

export function QuitButton() {
  const onQuit = async () => {
    try {
      await window.app.quit();
    } catch (e) {
      console.error('Failed to quit app', e);
    }
  };
  return (
    <button id="quit-btn" className="quit-btn" title="Quitter" aria-label="Quitter" onClick={onQuit}>
      X
    </button>
  );
}
