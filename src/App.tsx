import './App.css'
import { Routes, Route } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './components/HomePage';
import GameView from './components/GameView';
import { RootDocument } from './docs/rootDoc';
import { useCallback } from 'react';

function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  const [rootDoc, changeRootDoc] = useDocument<RootDocument>(rootDocUrl, {
    suspense: true,
  });
  const addGame = useCallback((gameUrl: AutomergeUrl) => {
    changeRootDoc((doc) => {
      doc.games.push(gameUrl);
    });
  }, [changeRootDoc]);

  return (
    <div className="App">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage rootDoc={rootDoc} addGame={addGame} />} />
          <Route path="/game/:gameDocUrl" element={<GameView />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App
