import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { deleteRootDoc as removeRootDocFromStorage, RootDocument } from '../docs/rootDoc';
import { create as createGame } from '../docs/game';
import MainMenu from './MainMenu';
import GamesList from './GamesList';

type HomePageProps = {
  rootDocUrl: AutomergeUrl;
};

const HomePage: React.FC<HomePageProps> = ({ rootDocUrl }) => {
  const [rootDoc, changeRootDoc] = useDocument<RootDocument>(rootDocUrl, {
    suspense: true,
  });
  const repo = useRepo();
  const navigate = useNavigate();

  const handleDeleteRootDoc = () => {
    removeRootDocFromStorage();
    window.location.reload();
  };

  const handleNewGame = () => {
    if (!rootDoc || !repo) {
      throw new Error('Root document or repo not found');
    }
    if (!rootDoc.selfId) {
      throw new Error('Self ID not found');
    }
    
    // Create a new game document
    const gameHandle = createGame(repo, {
      players: [rootDoc.selfId]
    });

    // Add the game to the root document
    changeRootDoc((doc) => {
      doc.games.push(gameHandle.url);
    });

    // Navigate to the newly created game
    navigate(`/game/${gameHandle.url}`);
  };

  const handleGameSelect = (gameUrl: AutomergeUrl) => {
    navigate(`/game/${gameUrl}`);
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
