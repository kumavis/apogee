import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AutomergeUrl, useDocHandle, useRepo } from '@automerge/react';
import { GameDoc, getGameDeckSelection, joinGame } from '../docs/game';
import { GameEngine } from '../utils/GameEngine';
import { RootDocument } from '../docs/rootDoc';
import { useGameNavigation } from '../hooks/useGameNavigation';
import GameLobby from './GameLobby';
import TCGGameBoard from './TCGGameBoard';
import GameFinished from './GameFinished';
import { useDocFromHandle } from '../hooks/useDocFromHandle';
import { FollowerProvider } from '../utils/FollowerSystem';

type GameViewProps = {
  rootDoc: RootDocument;
  addGame: (gameUrl: AutomergeUrl) => void;
};

const GameView: React.FC<GameViewProps> = ({ rootDoc, addGame }) => {
  const { gameDocUrl } = useParams<{ gameDocUrl: AutomergeUrl }>();
  const { navigateToHome, navigateToGame } = useGameNavigation();
  const repo = useRepo();
  const gameDocHandle = useDocHandle<GameDoc>(gameDocUrl as AutomergeUrl);
  const [gameDoc, changeGameDoc] = useDocFromHandle<GameDoc>(gameDocHandle);
  const gameEngine = useMemo(() => {
    if (!gameDocHandle) {
      return null;
    }
    return GameEngine.create(gameDocHandle, repo);
  }, [gameDocHandle, repo]);
 
  const handleJoinGame = () => {
    if (!gameDoc) {
      throw new Error('handleJoinGame: Cannot join game - no game doc');
    }

    changeGameDoc((doc) => {
      joinGame(doc, rootDoc.selfId);
    });
      
    // Add game to user's games list when joining
    addGame(gameDocUrl as AutomergeUrl);
  };

  const handleStartGame = async () => {
    try {
      if (!gameDoc || !gameEngine) {
        throw new Error('handleStartGame: Cannot start game - missing gameDoc or gameEngine');
      }
      
      // Get the deck selection for the game (required)
      const selectedDeckUrl = getGameDeckSelection(gameDoc);
      if (!selectedDeckUrl) {
        throw new Error('handleStartGame: Cannot start game - no deck selected');
      }

      // Use GameEngine to prepare deck and start the game
      const success = await gameEngine.startGameWithDeck(selectedDeckUrl);
      if (!success) {
        throw new Error('Failed to start game with selected deck');
      }
    } catch (error) {
      console.error('Error starting game with deck:', error);
      alert('Failed to start game. Please ensure the selected deck is available and try again.');
    }
  };

  const handleSpectateGame = () => {
    if (gameDocUrl) {
      addGame(gameDocUrl as AutomergeUrl);
    }
  };

  const handleCreateRematch = async () => {
    if (!gameDoc || !repo) {
      console.error('handleCreateRematch: Missing required dependencies');
      return;
    }

    // Get the game document handle
    const gameDocHandle = await repo.find<GameDoc>(gameDocUrl as AutomergeUrl);
    const gameEngine = GameEngine.create(gameDocHandle, repo);
    const rematchHandle = gameEngine.createRematchGame();
    addGame(rematchHandle.url);
    console.log(`Rematch created and added: ${rematchHandle.url}`);
    // Navigate to the newly created rematch game
    navigateToGame(rematchHandle.url);
  };

  if (!gameDoc || !gameEngine) {
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
    // We render the FollowerProvider here to avoid re-rendering the floating cards
    return (
      <FollowerProvider>
        <TCGGameBoard
          gameEngine={gameEngine}
          gameDoc={gameDoc}
          selfId={rootDoc.selfId}
          gameDocHandle={gameDocHandle!}
        />
      </FollowerProvider>
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
