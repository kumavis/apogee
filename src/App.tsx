import './App.css'
import { Routes, Route } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './components/HomePage';
import GameView from './components/GameView';
import Settings from './components/Settings';
import CardLibrary from './components/CardLibrary';
import CardView from './components/CardView';
import CardEditPage from './components/CardEditPage';
import DeckLibrary from './components/DeckLibrary';
import DeckView from './components/DeckView';
import DebugView from './components/DebugView';
import DebugOverlay from './components/DebugOverlay';
import { RootDocument } from './docs/rootDoc';
import { useCallback, useState, useEffect } from 'react';

function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  const [rootDoc, changeRootDoc] = useDocument<RootDocument>(rootDocUrl, {
    suspense: true,
  });

  // Debug overlay state
  const [isDebugOverlayOpen, setIsDebugOverlayOpen] = useState(false);

  // For debugging purposes, we store the rootDoc in the globalThis object
  if (rootDoc && !(globalThis as any).rootDoc) {
    (globalThis as any).rootDoc = rootDoc;
    (globalThis as any).changeRootDoc = changeRootDoc;
  }

  // Global keyboard event listener for debug overlay
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for backtick key (keyCode 192 or key '`')
      if (event.key === '`' || event.keyCode === 192) {
        // Prevent default behavior (like opening browser console)
        event.preventDefault();
        // Toggle debug overlay
        setIsDebugOverlayOpen(prev => !prev);
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const addCardsToLibrary = useCallback((cardUrls: AutomergeUrl[]) => {
    changeRootDoc((doc) => {
      // Add all cards that aren't already in the library
      for (const cardUrl of cardUrls) {
        if (!doc.cardLibrary.includes(cardUrl)) {
          doc.cardLibrary.push(cardUrl);
        }
      }
    });
  }, [changeRootDoc]);

  const addDeckToCollection = useCallback((deckUrl: AutomergeUrl) => {
    changeRootDoc((doc) => {
      // Only add if the deck is not already in the collection
      if (!doc.decks.includes(deckUrl)) {
        doc.decks.push(deckUrl);
      }
    });
  }, [changeRootDoc]);

  const removeCardFromLibrary = useCallback((cardUrl: AutomergeUrl) => {
    changeRootDoc((doc) => {
      const index = doc.cardLibrary.indexOf(cardUrl);
      if (index > -1) {
        doc.cardLibrary.splice(index, 1);
      }
    });
  }, [changeRootDoc]);

  const removeDeckFromCollection = useCallback((deckUrl: AutomergeUrl) => {
    changeRootDoc((doc) => {
      const index = doc.decks.indexOf(deckUrl);
      if (index > -1) {
        doc.decks.splice(index, 1);
      }
    });
  }, [changeRootDoc]);

  return (
    <div className="App">
      <ErrorBoundary>
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          width: '100%'
        }}>
          <Routes>
            <Route path="/" element={<HomePage rootDoc={rootDoc} addGame={addGame} />} />
            <Route path="/game/:gameDocUrl" element={<GameView rootDoc={rootDoc} addGame={addGame} />} />
            <Route path="/settings" element={<Settings rootDocUrl={rootDocUrl} selfId={rootDoc.selfId} />} />
            <Route path="/library" element={<CardLibrary rootDoc={rootDoc} addCardToLibrary={addCardToLibrary} removeCardFromLibrary={removeCardFromLibrary} />} />
            <Route path="/card/:cardId" element={<CardView rootDoc={rootDoc} addCardToLibrary={addCardToLibrary} />} />
            <Route path="/card/:cardId/edit" element={<CardEditPage rootDoc={rootDoc} addCardToLibrary={addCardToLibrary} />} />
            <Route path="/decks" element={<DeckLibrary rootDoc={rootDoc} addDeckToCollection={addDeckToCollection} addCardsToLibrary={addCardsToLibrary} removeDeckFromCollection={removeDeckFromCollection} />} />
            <Route path="/deck/:deckId" element={<DeckView rootDoc={rootDoc} addDeckToCollection={addDeckToCollection} addCardsToLibrary={addCardsToLibrary} />} />
            <Route path="/debug" element={<DebugView rootDocUrl={rootDocUrl} />} />
          </Routes>
        </div>
      </ErrorBoundary>

      {/* Debug Overlay - accessible from anywhere with backtick key */}
      <DebugOverlay
        isOpen={isDebugOverlayOpen}
        onClose={() => setIsDebugOverlayOpen(false)}
        rootDocUrl={rootDocUrl}
      />
    </div>
  )
}

export default App
