import './App.css'
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { deleteRootDoc as removeRootDocFromStorage, RootDocument } from './docs/rootDoc';
import { GameDoc, create as createGame } from './docs/game';
import ErrorBoundary from './components/ErrorBoundary';
import MainMenu from './components/MainMenu';
import GamesList from './components/GamesList';

function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  // Get the root document to access games
  const [rootDoc, changeRootDoc] = useDocument<RootDocument>(rootDocUrl, {
    suspense: true,
  });
  const repo = useRepo();

  const handleDeleteRootDoc = () => {
    removeRootDocFromStorage();
    window.location.reload();
  };

  const handleNewGame = () => {
    if (!rootDoc || !repo) return;
    
    // Create a new game document
    const gameHandle = repo.create<GameDoc>();
    createGame(gameHandle, {
      createdAt: Date.now(),
      players: []
    });

    // Add the game to the root document
    changeRootDoc((doc) => {
      doc.games.push(gameHandle.url);
    });
  };

  const handleGameSelect = (gameUrl: AutomergeUrl) => {
    // TODO: Navigate to game view or implement game selection logic
    console.log('Selected game:', gameUrl);
  };
  
  return (
    <div className="App">
      <ErrorBoundary>
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
      </ErrorBoundary>
    </div>
  )
}

export default App
