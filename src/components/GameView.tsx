import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { getFormattedTime } from '../utils/timeUtils';

const GameView: React.FC = () => {
  const { gameDocUrl } = useParams<{ gameDocUrl: string }>();
  const navigate = useNavigate();
  
  const [gameDoc] = useDocument<GameDoc>(gameDocUrl as AutomergeUrl, {
    suspense: false,
  });

  const handleBackToMenu = () => {
    navigate('/');
  };

  if (!gameDoc) {
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
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: 16 }}>Loading Game...</h2>
        <button
          onClick={handleBackToMenu}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '12px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          ← Back to Menu
        </button>
      </div>
    );
  }

  // Get formatted time information
  const timeInfo = getFormattedTime(gameDoc.createdAt);
  const playerCount = gameDoc.players?.length || 0;

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
      {/* Header with back button */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 24 
      }}>
        <button
          onClick={handleBackToMenu}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
        >
          ← Back to Menu
        </button>
        <h1 style={{ 
          fontSize: 24, 
          margin: 0, 
          fontWeight: 600,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Game #{gameDocUrl?.slice(-8)}
        </h1>
        <div style={{ width: 120 }} /> {/* Spacer for centering */}
      </div>

      {/* Game Info */}
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>
          Game Information
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Created</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{timeInfo.relative}</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {timeInfo.absolute}{timeInfo.absoluteTime && ` at ${timeInfo.absoluteTime}`}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Players</div>
            <div style={{ fontSize: 14 }}>{playerCount} player{playerCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Game Content Area */}
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        padding: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        minHeight: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ 
          fontSize: 18, 
          marginBottom: 12, 
          opacity: 0.8 
        }}>
          🎮 Game Content
        </div>
        <div style={{ 
          fontSize: 14, 
          opacity: 0.6,
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          This is where the actual game interface will be implemented.
          <br />
          For now, this serves as a placeholder for game-specific content.
        </div>
      </div>

      {/* Debug Info (can be removed later) */}
      <details style={{ marginTop: 20 }}>
        <summary style={{ 
          cursor: 'pointer', 
          fontSize: 12, 
          opacity: 0.7,
          marginBottom: 8
        }}>
          Debug Info
        </summary>
        <pre style={{
          background: 'rgba(0,0,0,0.3)',
          padding: 12,
          borderRadius: 6,
          fontSize: 11,
          overflow: 'auto',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {JSON.stringify(gameDoc, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default GameView;
