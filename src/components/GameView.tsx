import React from 'react';
import { useParams } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { RootDocument } from '../docs/rootDoc';
import { getFormattedTime } from '../utils/timeUtils';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Contact from './Contact';

type GameViewProps = {
  rootDoc: RootDocument;
  addGame: (gameUrl: AutomergeUrl) => void;
};

const GameView: React.FC<GameViewProps> = ({ rootDoc, addGame }) => {
  const { gameDocUrl } = useParams<{ gameDocUrl: string }>();
  const { navigateToHome } = useGameNavigation();
  
  const [gameDoc, changeGameDoc] = useDocument<GameDoc>(gameDocUrl as AutomergeUrl, {
    suspense: false,
  });

  const handleBackToMenu = () => {
    navigateToHome();
  };

  const handleJoinGame = () => {
    if (gameDoc && changeGameDoc && gameDocUrl) {
      changeGameDoc((doc) => {
        if (!doc.players.includes(rootDoc.selfId)) {
          doc.players.push(rootDoc.selfId);
        }
      });
      
      // Add game to user's games list when joining
      if (!isGameInList) {
        addGame(gameDocUrl as AutomergeUrl);
      }
    }
  };

  const handleStartGame = () => {
    if (gameDoc && changeGameDoc) {
      changeGameDoc((doc) => {
        doc.status = 'playing';
      });
    }
  };

  const handleSpectateGame = () => {
    if (gameDocUrl && !isGameInList) {
      addGame(gameDocUrl as AutomergeUrl);
    }
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
  const playerCount = gameDoc.players.length;
  
  // Check if current user is in the game
  const isPlayerInGame = gameDoc.players.includes(rootDoc.selfId);
  const canJoinGame = gameDoc.status === 'waiting' && !isPlayerInGame;
  
  // Check if current user is the host (first player in the list)
  const isHost = gameDoc.players.length > 0 && gameDoc.players[0] === rootDoc.selfId;
  const canStartGame = gameDoc.status === 'waiting' && isHost;
  
  // Check if this game is already in the user's games list
  const isGameInList = rootDoc.games.includes(gameDocUrl as AutomergeUrl);
  const canSpectate = !isGameInList;
  
  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'waiting':
        return { text: 'Waiting for Players', color: '#ffa940', emoji: '⏳' };
      case 'playing':
        return { text: 'Game in Progress', color: '#52c41a', emoji: '🎮' };
      case 'finished':
        return { text: 'Game Finished', color: '#ff4d4f', emoji: '🏁' };
      default:
        return { text: 'Unknown', color: '#d9d9d9', emoji: '❓' };
    }
  };
  
  const statusInfo = getStatusInfo(gameDoc.status);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Game Information
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {canJoinGame && (
              <button
                onClick={handleJoinGame}
                style={{
                  background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(82, 196, 26, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(82, 196, 26, 0.3)';
                }}
              >
                🎮 Join Game
              </button>
            )}
            {canSpectate && (
              <button
                onClick={handleSpectateGame}
                style={{
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.3)';
                }}
              >
                👁️ Spectate
              </button>
            )}
            {canStartGame && (
              <button
                onClick={handleStartGame}
                style={{
                  background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(114, 46, 209, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(114, 46, 209, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(114, 46, 209, 0.3)';
                }}
              >
                🚀 Start Game
              </button>
            )}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Status</div>
            <div style={{ 
              fontSize: 14, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              color: statusInfo.color 
            }}>
              <span>{statusInfo.emoji}</span>
              <span>{statusInfo.text}</span>
            </div>
          </div>
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

        {/* Players List */}
        {gameDoc.players && gameDoc.players.length > 0 && (
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Current Players</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {gameDoc.players.map((playerUrl) => (
                <Contact 
                  key={playerUrl} 
                  contactUrl={playerUrl}
                  style={{
                    ...(playerUrl === rootDoc.selfId && {
                      background: 'rgba(103, 126, 234, 0.4)',
                      borderColor: 'rgba(103, 126, 234, 0.6)',
                    })
                  }}
                />
              ))}
            </div>
          </div>
        )}
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
