import React, { useState } from 'react';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { ContactDoc } from '../docs/contact';
import { useGameNavigation } from '../hooks/useGameNavigation';
import GameLog from './GameLog';

type GameFinishedProps = {
  gameDoc: GameDoc;
  selfId: AutomergeUrl;
  onReturnToMenu: () => void;
  onCreateRematch: () => void;
};

const GameFinished: React.FC<GameFinishedProps> = ({ 
  gameDoc,
  selfId, 
  onReturnToMenu,
  onCreateRematch
}) => {
  const [showGameLog, setShowGameLog] = useState(false);
  const { navigateToGame } = useGameNavigation();

  // Find the winner (player with health > 0)
  const winner = gameDoc.playerStates?.find(state => state.health > 0);
  const isWinner = winner?.playerId === selfId;
  
  // Get game statistics
  const totalTurns = gameDoc.turn || 1;
  const totalActions = gameDoc.gameLog?.length || 0;
  const gameDuration = gameDoc.gameLog?.length > 0 ? 
    gameDoc.gameLog[gameDoc.gameLog.length - 1].timestamp - gameDoc.gameLog[0].timestamp : 0;

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleJoinRematch = () => {
    if (!gameDoc.rematchGameId) {
      console.error('handleJoinRematch: No rematch game ID found');
      return;
    }

    navigateToGame(gameDoc.rematchGameId);
  };

  const PlayerName: React.FC<{ playerId: AutomergeUrl }> = ({ playerId }) => {
    const [contactDoc] = useDocument<ContactDoc>(playerId, { suspense: false });
    return <span>{contactDoc?.name || 'Player'}</span>;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(26,26,46,0.95) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: `3px solid ${isWinner ? '#00ff00' : '#ff4444'}`,
        borderRadius: 20,
        padding: 40,
        textAlign: 'center',
        boxShadow: `0 20px 60px rgba(${isWinner ? '0, 255, 0' : '255, 68, 68'}, 0.4)`,
        maxWidth: showGameLog ? 800 : 500,
        maxHeight: '90vh',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Celebration Header */}
        <div style={{
          fontSize: 64,
          marginBottom: 20,
          animation: 'bounce 2s infinite'
        }}>
          {isWinner ? '🎉' : '💀'}
        </div>
        
        <div style={{
          fontSize: 36,
          fontWeight: 700,
          color: isWinner ? '#00ff00' : '#ff4444',
          marginBottom: 10,
          textShadow: `0 0 20px ${isWinner ? '#00ff00' : '#ff4444'}40`
        }}>
          {isWinner ? 'VICTORY!' : 'DEFEAT!'}
        </div>

        {winner && (
          <div style={{
            fontSize: 18,
            color: '#00ffff',
            marginBottom: 20,
            fontWeight: 600
          }}>
            🏆 Winner: <PlayerName playerId={winner.playerId} />
          </div>
        )}

        <div style={{
          fontSize: 16,
          color: '#ccc',
          marginBottom: 30,
          lineHeight: 1.5
        }}>
          {isWinner ? 
            'You have emerged victorious in this epic battle!' : 
            'A valiant effort, but victory eluded you this time!'
          }
        </div>

        {/* Game Statistics */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 30,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#00ffff' }}>{totalTurns}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Turns</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#00ffff' }}>{totalActions}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Actions</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#00ffff' }}>
              {formatDuration(gameDuration)}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Duration</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowGameLog(!showGameLog)}
            style={{
              background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(114, 46, 209, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            📋 {showGameLog ? 'Hide' : 'Show'} Game Log
          </button>
          
          {/* Rematch Button Logic */}
          {gameDoc.rematchGameId ? (
            <button
              onClick={handleJoinRematch}
              style={{
                background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(82, 196, 26, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              🎮 Join Rematch!
            </button>
          ) : (
            <button
              onClick={onCreateRematch}
              style={{
                background: 'linear-gradient(135deg, #ff7a45 0%, #d73502 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(255, 122, 69, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              🔥 Rematch!
            </button>
          )}
          
          <button
            onClick={onReturnToMenu}
            style={{
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            🏠 Return to Menu
          </button>
        </div>

        {/* Game Log */}
        {showGameLog && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'left'
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#00ffff',
              marginBottom: 16
            }}>
              📋 Complete Game History
            </div>
            
            <GameLog
              gameLog={gameDoc.gameLog || []}
              isExpanded={true}
              canToggle={false}
              position="relative"
              style={{
                background: 'transparent',
                border: 'none',
                maxHeight: 300,
                width: '100%'
              }}
            />
          </div>
        )}

        {/* CSS Animation */}
        <style>{`
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
              transform: translateY(0);
            }
            40% {
              transform: translateY(-10px);
            }
            60% {
              transform: translateY(-5px);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default GameFinished;
