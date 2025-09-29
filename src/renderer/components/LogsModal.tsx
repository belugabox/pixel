import React, { useEffect, useMemo, useRef, useState } from 'react';

type LogLevel = 'log' | 'warn' | 'error';
type Entry = { ts: number; level: LogLevel; args: unknown[] };

export function LogsModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const initial = await window.logs.get(1000);
        if (!active) return;
        setEntries(initial);
      } catch { /* ignore */ }
    })();
    const off = window.logs.onAppend((e) => {
      setEntries((prev) => [...prev, e].slice(-2000));
    });
    return () => { active = false; off(); };
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, autoScroll]);

  const rows = useMemo(() => entries.map((e, i) => {
    const dt = new Date(e.ts);
    const h = dt.toLocaleTimeString();
    let color = '#ddd';
    if (e.level === 'warn') color = '#ffaa00';
    if (e.level === 'error') color = '#ff4d4d';
    const text = e.args.map(a => {
      try {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.stack || a.message;
        return JSON.stringify(a);
      } catch { return String(a); }
    }).join(' ');
    return (
      <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color }}>
        <span style={{ opacity: 0.7 }}>[{h}]</span> <strong style={{ textTransform: 'uppercase' }}>{e.level}</strong> {text}
      </div>
    );
  }), [entries]);

  const onClear = async () => {
    try {
      await window.logs.clear();
    } finally {
      setEntries([]);
    }
  };

  return (
    <div id="logs-modal" className="modal-overlay" role="dialog" aria-modal="true" style={{ display: 'flex' }}>
      <div className="modal" style={{ width: 'min(1200px, 92vw)', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Logs Electron</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll
          </label>
          <button onClick={onClear} title="Vider">Vider</button>
          <button onClick={onClose} title="Fermer">Fermer</button>
        </div>
        <div ref={boxRef} className="modal-body" style={{ overflow: 'auto', flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.35)', borderRadius: 6 }}>
          {rows}
        </div>
      </div>
    </div>
  );
}
