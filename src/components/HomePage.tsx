import React from 'react';
import { AutomergeUrl, useRepo } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { create as createGame } from '../docs/game';
import { useGameNavigation } from '../hooks/useGameNavigation';
import MainMenu from './MainMenu';
import GamesList from './GamesList';
import ErrorBoundary from './ErrorBoundary';

type HomePageProps = {
  rootDoc: RootDocument;
  addGame: (gameUrl: AutomergeUrl) => void;
};

const HomePage: React.FC<HomePageProps> = ({ rootDoc, addGame }) => {
  const repo = useRepo();
  const { navigateToGame } = useGameNavigation();

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
          />
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
            <ErrorBoundary
              fallback={
                <div
                  style={{
                    padding: '20px',
                    background: 'rgba(255, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 0, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#ff9999',
                    textAlign: 'center' as const,
                    marginTop: '20px',
                  }}
                >
                  <h3 style={{ margin: '0 0 10px 0', color: '#ff6666' }}>🎮 Games List Error</h3>
                  <p style={{ margin: '0 0 15px 0' }}>
                    There was a problem loading your games list.
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
                    Try refreshing the page or creating a new game from the menu above.
                  </p>
                </div>
              }
              onError={(error, errorInfo) => {
                console.error('GamesList error:', error, errorInfo);
              }}
            >
              <GamesList 
                gameUrls={rootDoc.games}
                onGameSelect={handleGameSelect}
              />
            </ErrorBoundary>
          </div>
        </>
      )}
    </>
  );
};

export default HomePage;
