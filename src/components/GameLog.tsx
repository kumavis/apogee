import React, { useState, useEffect } from 'react';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { GameLogEntry } from '../docs/game';
import { ContactDoc } from '../docs/contact';
import { getRelativeTime } from '../utils/timeUtils';

type GameLogProps = {
  gameLog: GameLogEntry[];
  cardLibrary: { [cardId: string]: any };
};

const GameLog: React.FC<GameLogProps> = ({ gameLog, cardLibrary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setCurrentTime] = useState(Date.now());

  // Update current time every minute to refresh relative times
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const formatLogEntry = (entry: GameLogEntry) => {
    const card = entry.cardId ? cardLibrary[entry.cardId] : null;
    const cardName = card ? card.name : 'Unknown Card';
    
    switch (entry.action) {
      case 'game_start':
        return `Game started`;
      case 'play_card':
        return `Played ${cardName}`;
      case 'end_turn':
        return `Ended turn`;
      case 'draw_card':
        return `Drew a card`;
      default:
        return entry.description;
    }
  };

  const PlayerName: React.FC<{ playerId: AutomergeUrl }> = ({ playerId }) => {
    const [contactDoc] = useDocument<ContactDoc>(playerId, { suspense: false });
    return <span>{contactDoc?.name || 'Player'}</span>;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 70,
      right: 20,
      width: 300,
      maxHeight: isExpanded ? 400 : 50,
      background: 'rgba(0, 0, 0, 0.9)',
      border: '1px solid rgba(0, 255, 255, 0.3)',
      borderRadius: 8,
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      zIndex: 1000
    }}>
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '12px 16px',
          background: 'rgba(0, 255, 255, 0.1)',
          borderBottom: isExpanded ? '1px solid rgba(0, 255, 255, 0.3)' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#00ffff',
          fontSize: 14,
          fontWeight: 600
        }}
      >
        <span>📜 Game Log ({gameLog.length})</span>
        <span style={{ 
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease'
        }}>
          ▼
        </span>
      </div>

      {/* Log Content */}
      {isExpanded && (
        <div style={{
          maxHeight: 350,
          overflowY: 'auto',
          padding: '8px 0'
        }}>
          {gameLog.length === 0 ? (
            <div style={{
              padding: '16px',
              color: '#888',
              textAlign: 'center',
              fontSize: 12
            }}>
              No actions yet
            </div>
          ) : (
            gameLog.slice().reverse().map((entry, index) => (
              <div 
                key={entry.id}
                style={{
                  padding: '8px 16px',
                  borderBottom: index < gameLog.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  fontSize: 11,
                  color: '#fff'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginBottom: 2
                }}>
                  <span style={{ color: '#00ffff', fontWeight: 500 }}>
                    <PlayerName playerId={entry.playerId} />
                  </span>
                  <span 
                    style={{ color: '#888', fontSize: 10, cursor: 'help' }}
                    title={new Date(entry.timestamp).toLocaleString()}
                  >
                    {getRelativeTime(entry.timestamp, { style: 'short' })}
                  </span>
                </div>
                <div style={{ color: '#ccc' }}>
                  {formatLogEntry(entry)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default GameLog;
