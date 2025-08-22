import React from 'react';
import { useParams } from 'react-router-dom';
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { GameDoc, initializeGame, createRematchGame, createGameDeckFromDeck, getGameDeckSelection } from '../docs/game';
import { RootDocument } from '../docs/rootDoc';
import { shuffleDeck } from '../utils/defaultCardLibrary';
import { useGameNavigation } from '../hooks/useGameNavigation';
import GameLobby from './GameLobby';
import TCGGameBoard from './TCGGameBoard';
import GameFinished from './GameFinished';

type GameViewProps = {
  rootDoc: RootDocument;
  addGame: (gameUrl: AutomergeUrl) => void;
};

const GameView: React.FC<GameViewProps> = ({ rootDoc, addGame }) => {
  const { gameDocUrl } = useParams<{ gameDocUrl: string }>();
  const { navigateToHome, navigateToGame } = useGameNavigation();
  const repo = useRepo();
  
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

  const handleStartGame = async () => {
    if (!changeGameDoc || !gameDoc) {
      console.error('handleStartGame: Cannot start game - missing changeGameDoc or gameDoc');
      return;
    }
    
    try {
      // Get the deck selection for the game (required)
      const selectedDeckUrl = getGameDeckSelection(gameDoc);
      
      if (!selectedDeckUrl) {
        console.error('handleStartGame: Cannot start game - no deck selected');
        alert('Please select a deck before starting the game.');
        return;
      }
      
      // Create game deck from the selected deck (no snapshotting)
      const deckForGame = await createGameDeckFromDeck(selectedDeckUrl, repo);
      const shuffledDeck = shuffleDeck(deckForGame);
      
      // Initialize the game state with the deck
      changeGameDoc((doc) => {
        // Initialize the game with the shuffled deck
        initializeGame(doc, shuffledDeck);
      });
    } catch (error) {
      console.error('Error starting game with deck:', error);
      alert('Failed to start game. Please ensure the selected deck is available and try again.');
    }
  };

  const handleSpectateGame = () => {
    if (gameDocUrl) {
      const isGameInList = rootDoc.games.includes(gameDocUrl as AutomergeUrl);
      if (!isGameInList) {
        addGame(gameDocUrl as AutomergeUrl);
      }
    }
  };

  const handleCreateRematch = () => {
    if (!changeGameDoc || !repo || !gameDoc) {
      console.error('handleCreateRematch: Missing required dependencies');
      return;
    }

    changeGameDoc((doc) => {
      const rematchId = createRematchGame(doc, repo);
      if (rematchId) {
        addGame(rematchId);
        console.log(`Rematch created and added: ${rematchId}`);
        // Navigate to the newly created rematch game
        navigateToGame(rematchId);
      }
    });
  };

  if (!gameDoc) {
    return (
      <div style={{
        maxWidth: 800,
        margin: '20px auto',
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
  if (gameDoc.status === 'finished') {
    return (
      <GameFinished
        gameDoc={gameDoc}
        selfId={rootDoc.selfId}
        onReturnToMenu={navigateToHome}
        onCreateRematch={handleCreateRematch}
      />
    );
  }

  if (gameDoc.status === 'playing') {
    return (
      <TCGGameBoard
        gameDoc={gameDoc}
        selfId={rootDoc.selfId}
        changeGameDoc={changeGameDoc}
      />
    );
  }

  // For 'waiting' status, show the lobby
  return (
    <GameLobby
      gameDoc={gameDoc}
      gameDocUrl={gameDocUrl!}
      rootDoc={rootDoc}
      addGame={addGame}
      onJoinGame={handleJoinGame}
      onStartGame={handleStartGame}
      onSpectateGame={handleSpectateGame}
      changeGameDoc={changeGameDoc}
    />
  );
};

export default GameView;
