import React from 'react';

interface SplashScreenProps {
  wheelImage?: string;
  systemId: string;
  romFileName: string;
}

export function SplashScreen({ wheelImage }: SplashScreenProps) {
  return (
    <div style={{
      margin: 0,
      padding: 0,
      background: 'black',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      color: 'white',
    }}>
      {wheelImage && (
        <img
          src={wheelImage}
          alt="Game wheel"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  );
}
