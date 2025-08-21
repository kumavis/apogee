import React, { useState, useMemo } from 'react';
import { AutomergeUrl, useDocument, useDocuments } from '@automerge/react';
import { GameDoc, getGameDeckSelection } from '../docs/game';
import { ContactDoc } from '../docs/contact';
import { Deck } from '../docs/deck';
import { getRelativeTime } from '../utils/timeUtils';

// Helper component to get player name
const PlayerName: React.FC<{ playerId: AutomergeUrl }> = ({ playerId }) => {
  const [contactDoc] = useDocument<ContactDoc>(playerId, { suspense: false });
  return <span>{contactDoc?.name || 'Player'}</span>;
};

// Helper component to get deck name
const DeckName: React.FC<{ deckUrl: AutomergeUrl | null }> = ({ deckUrl }) => {
  const [deck] = useDocument<Deck>(deckUrl || '' as AutomergeUrl, { suspense: false });
  
  if (!deckUrl) {
    return <span>Default Deck</span>;
  }
  
  if (!deck) {
    return <span>Loading...</span>;
  }
  
  return <span>{deck.name}</span>;
};

type GameListEntryProps = {
  gameUrl: AutomergeUrl;
  onClick: (gameUrl: AutomergeUrl) => void;
  selfId: AutomergeUrl;
};

const GameListEntry: React.FC<GameListEntryProps> = ({ gameUrl, onClick, selfId }) => {
  const [isHovered, setIsHovered] = useState(false);
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
  
  // Get selected deck information
  const selectedDeckUrl = getGameDeckSelection(gameDoc);
  
  // Get status display info
  const getStatusInfo = (status: string) => {
    if (status === 'playing' && gameDoc.players && gameDoc.players.length > 0) {
      // For playing games, show current player instead of "Playing"
      const currentPlayerId = gameDoc.players[gameDoc.currentPlayerIndex];
      const isMyTurn = currentPlayerId === selfId;
      
      if (isMyTurn) {
        return {
          content: 'Your turn',
          color: '#00ff00',
          emoji: '🎯'
        };
      } else {
        return {
          content: <><PlayerName playerId={currentPlayerId} />'s turn</>,
          color: '#ffaa00',
          emoji: '⏳'
        };
      }
    }
    
    switch (status) {
      case 'waiting':
        return { content: 'Waiting to start', color: '#ffa940', emoji: '⏳' };
      case 'playing':
        return { content: 'Playing', color: '#52c41a', emoji: '🎮' }; // Fallback
      case 'finished':
        return { content: 'Finished', color: '#ff4d4f', emoji: '🏁' };
      default:
        return { content: 'Unknown', color: '#d9d9d9', emoji: '❓' };
    }
  };
  
  const statusInfo = getStatusInfo(gameDoc.status);
  
  // Check if it's the player's turn for highlighting
  const isMyTurn = gameDoc.status === 'playing' && 
    gameDoc.players && 
    gameDoc.players[gameDoc.currentPlayerIndex] === selfId;

  // Calculate dynamic styles based on state
  const getBackgroundColor = () => {
    return isHovered ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)';
  };

  const getBorderColor = () => {
    if (isMyTurn) {
      return isHovered ? 'rgb(218, 178, 255)' : 'rgba(196, 136, 255, 0.8)';
    }
    return isHovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)';
  };

  const getBorderWidth = () => {
    return isMyTurn ? '2px' : '1px';
  };
  return (
    <div 
      onClick={() => onClick(gameUrl)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: 16,
        border: `${getBorderWidth()} solid ${getBorderColor()}`,
        borderRadius: 8,
        background: getBackgroundColor(),
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        color: '#fff',
        boxShadow: isMyTurn 
          ? '0 0 20px rgba(147, 51, 234, 0.4), 0 0 40px rgba(147, 51, 234, 0.2)' 
          : 'none',
        position: 'relative' as const
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Game #{gameUrl.slice(-8)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Created {relativeTime}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: statusInfo.color,
            background: `${statusInfo.color}20`,
            padding: '2px 6px',
            borderRadius: 4,
            border: `1px solid ${statusInfo.color}40`
          }}>
            <span>{statusInfo.emoji}</span>
            <span>{statusInfo.content}</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {playerCount} player{playerCount !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>
            🃏 <DeckName deckUrl={selectedDeckUrl} />
          </div>
        </div>
      </div>
    </div>
  );
};

type GamesListProps = {
  gameUrls: AutomergeUrl[];
  onGameSelect: (gameUrl: AutomergeUrl) => void;
  selfId: AutomergeUrl;
};

const GamesList: React.FC<GamesListProps> = ({ gameUrls, onGameSelect, selfId }) => {
  // Use useDocuments to get all game documents at once
  const [gameDocsMap] = useDocuments<GameDoc>(gameUrls, { suspense: false });
  
  // Get loaded games and sort them by creation date (newest first)
  const loadedGameUrls = useMemo(() => {
    return gameUrls
      .filter(url => gameDocsMap.get(url)) // Only include loaded games
      .sort((a, b) => {
        const gameA = gameDocsMap.get(a)!;
        const gameB = gameDocsMap.get(b)!;
        return (gameB.createdAt || 0) - (gameA.createdAt || 0);
      });
  }, [gameUrls, gameDocsMap]);

  // Check if there are still games loading
  const hasLoadingGames = gameUrls.length > loadedGameUrls.length;

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
        {/* Render only loaded games */}
        {loadedGameUrls.map((gameUrl) => (
          <GameListEntry
            key={gameUrl}
            gameUrl={gameUrl}
            onClick={onGameSelect}
            selfId={selfId}
          />
        ))}
        
        {/* Show loading spinner if there are still games loading */}
        {hasLoadingGames && (
          <div style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: '#999',
            fontSize: 12
          }}>
            <div style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.2)',
              borderTop: '2px solid #00ffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Loading games...
          </div>
        )}
      </div>
      
      {/* Add CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GamesList;
