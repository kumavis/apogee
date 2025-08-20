import './App.css'
import { Routes, Route } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './components/HomePage';
import GameView from './components/GameView';
import Settings from './components/Settings';
import CardLibrary from './components/CardLibrary';
import { RootDocument } from './docs/rootDoc';
import { useCallback } from 'react';

function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  const [rootDoc, changeRootDoc] = useDocument<RootDocument>(rootDocUrl, {
    suspense: true,
  });

  // For debugging purposes, we store the rootDoc in the globalThis object
  if (rootDoc && !(globalThis as any).rootDoc) {
    (globalThis as any).rootDoc = rootDoc;
    (globalThis as any).changeRootDoc = changeRootDoc;
  }

  const addGame = useCallback((gameUrl: AutomergeUrl) => {
    changeRootDoc((doc) => {
      // Only add if the game is not already in the list
      if (!doc.games.includes(gameUrl)) {
        doc.games.push(gameUrl);
      }
    });
  }, [changeRootDoc]);

  const addCardToLibrary = useCallback((cardUrl: AutomergeUrl) => {
    changeRootDoc((doc) => {
      // Only add if the card is not already in the library
      if (!doc.cardLibrary.includes(cardUrl)) {
        doc.cardLibrary.push(cardUrl);
      }
    });
  }, [changeRootDoc]);

  return (
    <div className="App">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage rootDoc={rootDoc} addGame={addGame} />} />
          <Route path="/game/:gameDocUrl" element={<GameView rootDoc={rootDoc} addGame={addGame} />} />
          <Route path="/settings" element={<Settings rootDocUrl={rootDocUrl} selfId={rootDoc.selfId} />} />
          <Route path="/library" element={<CardLibrary rootDoc={rootDoc} addCardToLibrary={addCardToLibrary} />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App
