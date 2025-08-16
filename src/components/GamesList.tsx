import React from 'react';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { getRelativeTime } from '../utils/timeUtils';

type GameListEntryProps = {
  gameUrl: AutomergeUrl;
  onClick: (gameUrl: AutomergeUrl) => void;
};

const GameListEntry: React.FC<GameListEntryProps> = ({ gameUrl, onClick }) => {
  const [gameDoc] = useDocument<GameDoc>(gameUrl, {
    suspense: false,
  });

  if (!gameDoc) {
    return (
      <div style={{
        padding: 16,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.2)',
        marginBottom: 8,
        color: '#999'
      }}>
        Loading game...
      </div>
    );
  }

  // Get relative time for display
  const relativeTime = getRelativeTime(gameDoc.createdAt);
  const playerCount = gameDoc.players?.length || 0;

  return (
    <div 
      onClick={() => onClick(gameUrl)}
      style={{
        padding: 16,
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.2)',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        color: '#fff'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Game #{gameUrl.slice(-8)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Created {relativeTime}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            {playerCount} player{playerCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

type GamesListProps = {
  gameUrls: AutomergeUrl[];
  onGameSelect: (gameUrl: AutomergeUrl) => void;
};

const GamesList: React.FC<GamesListProps> = ({ gameUrls, onGameSelect }) => {
  if (gameUrls.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        color: '#999',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>No games yet</div>
        <div style={{ fontSize: 14 }}>Create your first game to get started!</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ 
        color: '#fff', 
        marginBottom: 16, 
        fontSize: 18,
        fontWeight: 600 
      }}>
        Current Games ({gameUrls.length})
      </h3>
      <div>
        {gameUrls.map((gameUrl) => (
          <GameListEntry
            key={gameUrl}
            gameUrl={gameUrl}
            onClick={onGameSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default GamesList;
