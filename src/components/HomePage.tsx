import React from 'react';
import { AutomergeUrl, useRepo } from '@automerge/react';
import { deleteRootDoc as removeRootDocFromStorage, RootDocument } from '../docs/rootDoc';
import { create as createGame } from '../docs/game';
import { useGameNavigation } from '../hooks/useGameNavigation';
import MainMenu from './MainMenu';
import GamesList from './GamesList';

type HomePageProps = {
  rootDoc: RootDocument;
  addGame: (gameUrl: AutomergeUrl) => void;
};

const HomePage: React.FC<HomePageProps> = ({ rootDoc, addGame }) => {
  const repo = useRepo();
  const { navigateToGame } = useGameNavigation();

  const handleDeleteRootDoc = () => {
    removeRootDocFromStorage();
    window.location.reload();
  };

  const handleNewGame = () => {
    // Create a new game document
    const gameHandle = createGame(repo, {
      players: [rootDoc.selfId]
    });

    // Add the game to the root document
    addGame(gameHandle.url);

    // Navigate to the newly created game
    navigateToGame(gameHandle.url);
  };

  const handleGameSelect = (gameUrl: AutomergeUrl) => {
    navigateToGame(gameUrl);
  };

  return (
    <>
      {rootDoc && (
        <>
          <MainMenu 
            onNewGame={handleNewGame}
            onDeleteRootDoc={handleDeleteRootDoc}
          />
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
            <GamesList 
              gameUrls={rootDoc.games}
              onGameSelect={handleGameSelect}
            />
          </div>
        </>
      )}
    </>
  );
};

export default HomePage;
