import React, { useState } from 'react';
import { useGameNavigation } from '../hooks/useGameNavigation';

type MainMenuProps = {
  onNewGame: () => void;
};

const MainMenu: React.FC<MainMenuProps> = ({ onNewGame }) => {
  const { navigateToSettings } = useGameNavigation();
  
  // Array of potential game names
  const gameNames = [
    'Card Game, The Playable',
    'FarceStone',
    'Tragic: Nerd Gathering',
    'Gagic the Mathering',
    'Making the Game-thering',
    '1KCE'
  ];
  
  // State to track current name index
  const [currentNameIndex, setCurrentNameIndex] = useState(0);
  
  // Get current name and handler to cycle to next
  const currentGameName = gameNames[currentNameIndex];
  const handleTitleClick = () => {
    setCurrentNameIndex((prevIndex) => (prevIndex + 1) % gameNames.length);
  };
  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 24,
      color: '#fff',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      position: 'relative' as const
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        marginBottom: 32 
      }}>
        <h1 
          onClick={handleTitleClick}
          style={{ 
            fontSize: 48, 
            margin: '0 0 24px 0', 
            fontWeight: 700,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #00ffff 0%, #00ff00 50%, #ff4444 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            userSelect: 'none' as const
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.textShadow = '0 0 30px rgba(0, 255, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.textShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
          }}
        >
          {currentGameName}
        </h1>
        <button
          onClick={navigateToSettings}
          style={{
            background: 'rgba(102, 126, 234, 0.8)',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease',
            alignSelf: 'flex-end',
            position: 'absolute' as const,
            top: '24px',
            right: '24px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(102, 126, 234, 1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.8)';
            e.currentTarget.style.transform = 'translateY(0px)';
          }}
        >
          ⚙️ Settings
        </button>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        marginBottom: 32
      }}>
        <button
          onClick={onNewGame}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            padding: '16px 32px',
            borderRadius: 12,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease',
            minWidth: 200
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0px)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
          }}
        >
          + New Game
        </button>
      </div>

      <div style={{
        textAlign: 'center',
        fontSize: 14,
        opacity: 0.7,
        lineHeight: 1.5
      }}>
        <div>Start a new multiplayer game session</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Games are automatically saved and synced across devices
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
