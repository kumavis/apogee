import './App.css'
import { Routes, Route } from 'react-router-dom';
import { AutomergeUrl } from '@automerge/react';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './components/HomePage';
import GameView from './components/GameView';

function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  return (
    <div className="App">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage rootDocUrl={rootDocUrl} />} />
          <Route path="/game/:gameDocUrl" element={<GameView />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App
