import React from 'react';
import { useGameNavigation } from '../hooks/useGameNavigation';

type MainMenuProps = {
  onNewGame: () => void;
};

const MainMenu: React.FC<MainMenuProps> = ({ onNewGame }) => {
  const { navigateToSettings } = useGameNavigation();
  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 24,
      color: '#fff',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 24 
      }}>
        <h1 style={{ 
          fontSize: 24, 
          margin: 0, 
          fontWeight: 600,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Apogee Games
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
            transition: 'all 0.2s ease'
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
