import React from 'react';
import { useParams } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { GameDoc, PlayerHand } from '../docs/game';
import { RootDocument } from '../docs/rootDoc';
import { createStandardDeck, shuffleDeck, drawCards } from '../utils/cardLibrary';
import GameLobby from './GameLobby';
import TCGGameBoard from './TCGGameBoard';

type GameViewProps = {
  rootDoc: RootDocument;
  addGame: (gameUrl: AutomergeUrl) => void;
};

const GameView: React.FC<GameViewProps> = ({ rootDoc, addGame }) => {
  const { gameDocUrl } = useParams<{ gameDocUrl: string }>();
  
  const [gameDoc, changeGameDoc] = useDocument<GameDoc>(gameDocUrl as AutomergeUrl, {
    suspense: false,
  });

  const handleJoinGame = () => {
    if (gameDoc && changeGameDoc && gameDocUrl) {
      changeGameDoc((doc) => {
        if (!doc.players.includes(rootDoc.selfId)) {
          doc.players.push(rootDoc.selfId);
        }
      });
      
      // Add game to user's games list when joining
      const isGameInList = rootDoc.games.includes(gameDocUrl as AutomergeUrl);
      if (!isGameInList) {
        addGame(gameDocUrl as AutomergeUrl);
      }
    }
  };

  const handleStartGame = () => {
    if (!changeGameDoc || !gameDoc) return;
    
    // Initialize the game state
    changeGameDoc((doc) => {
      // Create and shuffle the deck
      const standardDeck = createStandardDeck();
      const shuffledDeck = shuffleDeck(standardDeck);
      
      // Initialize player hands
      const playerHands: PlayerHand[] = [];
      let currentDeck = [...shuffledDeck];
      
      // Deal 5 cards to each player
      doc.players.forEach((playerId) => {
        const { drawnCards, remainingDeck } = drawCards(currentDeck, 5);
        playerHands.push({
          playerId,
          cards: drawnCards
        });
        currentDeck = remainingDeck;
      });
      
      // Update the game document
      doc.status = 'playing';
      doc.deck = currentDeck;
      doc.playerHands = playerHands;
      doc.currentPlayerIndex = 0;
      doc.turn = 1;
    });
  };

  const handleSpectateGame = () => {
    if (gameDocUrl) {
      const isGameInList = rootDoc.games.includes(gameDocUrl as AutomergeUrl);
      if (!isGameInList) {
        addGame(gameDocUrl as AutomergeUrl);
      }
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
        <div style={{ 
          fontSize: 14, 
          opacity: 0.6 
        }}>
          Please wait while we load the game data...
        </div>
      </div>
    );
  }

  // Render different views based on game status
  if (gameDoc.status === 'playing') {
    return (
      <TCGGameBoard
        gameDoc={gameDoc}
        gameDocUrl={gameDocUrl!}
        rootDoc={rootDoc}
        playerList={gameDoc.players}
      />
    );
  }

  // For 'waiting' and 'finished' status, show the lobby
  return (
    <GameLobby
      gameDoc={gameDoc}
      gameDocUrl={gameDocUrl!}
      rootDoc={rootDoc}
      addGame={addGame}
      onJoinGame={handleJoinGame}
      onStartGame={handleStartGame}
      onSpectateGame={handleSpectateGame}
    />
  );
};

export default GameView;
