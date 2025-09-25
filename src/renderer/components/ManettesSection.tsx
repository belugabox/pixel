import React from 'react';
import { useGamepadStatus, type GamepadInfo } from '../hooks/useGamepadStatus';

function GamepadButton({ pressed, index }: { pressed: boolean; index: number }) {
  return (
    <span 
      style={{ 
        display: 'inline-block',
        minWidth: '20px',
        padding: '2px 4px',
        margin: '1px',
        backgroundColor: pressed ? '#ff156d' : '#333',
        color: pressed ? '#fff' : '#aaa',
        fontSize: '10px',
        borderRadius: '2px',
        textAlign: 'center',
      }}
    >
      {index}
    </span>
  );
}

function GamepadCard({ pad }: { pad: GamepadInfo }) {
  return (
    <div style={{ 
      border: '1px solid #555', 
      borderRadius: '4px', 
      padding: '12px', 
      marginBottom: '12px',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div style={{ color: '#ff156d', fontWeight: 'bold' }}>
          #{pad.index} {pad.connected ? '✓' : '✗'}
        </div>
        <div style={{ 
          fontSize: '10px', 
          color: pad.mapping === 'standard' ? '#1ec31e' : '#ffaa00' 
        }}>
          {pad.mapping}
        </div>
      </div>
      
      <div style={{ 
        fontSize: '12px', 
        color: '#ccc', 
        marginBottom: '8px',
        wordBreak: 'break-all',
      }}>
        {pad.id}
      </div>

      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>
          Boutons ({pad.buttons.length}):
        </div>
        <div style={{ lineHeight: 1.2 }}>
          {pad.buttons.map((pressed, i) => (
            <GamepadButton key={i} pressed={pressed} index={i} />
          ))}
        </div>
      </div>

      {pad.axes.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>
            Axes ({pad.axes.length}):
          </div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#ccc' }}>
            {pad.axes.map((value, i) => (
              <span key={i} style={{ marginRight: '8px' }}>
                {i}: {value.toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ManettesSection() {
  const status = useGamepadStatus();

  return (
    <>
      <h3>Statut XInput natif</h3>
      <div style={{ 
        padding: '8px 12px', 
        backgroundColor: status.globalWatcherActive ? 'rgba(30, 195, 30, 0.1)' : 'rgba(255, 170, 0, 0.1)',
        border: `1px solid ${status.globalWatcherActive ? '#1ec31e' : '#ffaa00'}`,
        borderRadius: '4px',
        marginBottom: '16px',
      }}>
        <div style={{ 
          color: status.globalWatcherActive ? '#1ec31e' : '#ffaa00',
          fontWeight: 'bold',
          marginBottom: '4px',
        }}>
          {status.globalWatcherActive === null ? 'Vérification...' : 
           status.globalWatcherActive ? 'Actif' : 'Inactif'}
        </div>
        <div style={{ fontSize: '12px', color: '#ccc' }}>
          {status.globalWatcherActive === null ? 
            'Vérification du statut de l\'addon natif...' :
           status.globalWatcherActive ? 
            'L\'addon natif XInput est chargé et surveille les combos Start+Select globalement.' :
            'L\'addon natif XInput n\'est pas disponible. Détection globale désactivée.'}
        </div>
      </div>

      <h3>Manettes connectées</h3>
      {status.pads.length === 0 ? (
        <div style={{ 
          padding: '16px', 
          textAlign: 'center', 
          color: '#aaa',
          backgroundColor: 'rgba(0,0,0,0.2)',
          border: '1px dashed #555',
          borderRadius: '4px',
        }}>
          Aucune manette détectée
        </div>
      ) : (
        <div>
          {status.pads.map(pad => (
            <GamepadCard key={pad.index} pad={pad} />
          ))}
        </div>
      )}

      <div style={{ 
        marginTop: '16px', 
        padding: '8px', 
        fontSize: '11px', 
        color: '#666',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: '4px',
      }}>
        <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
          Informations:
        </div>
        <div>• Branchez ou débranchez des manettes pour voir les changements</div>
        <div>• Les boutons pressés s'affichent en rose</div>
        <div>• Le mapping "standard" est recommandé pour une meilleure compatibilité</div>
        <div>• L'addon natif XInput permet la détection globale même quand la fenêtre n'a pas le focus</div>
      </div>
    </>
  );
}