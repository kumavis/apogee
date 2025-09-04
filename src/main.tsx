import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.tsx'
import {
  Repo,
  WebSocketClientAdapter,
  IndexedDBStorageAdapter,
  RepoContext,
} from "@automerge/react";
import { getOrCreateRoot } from "./docs/rootDoc";
import { HashRouter } from 'react-router-dom';

const storageAdapter = new IndexedDBStorageAdapter();

const repo = new Repo({
  network: [
    new WebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: storageAdapter,
});

// For debugging purposes
if (repo && !(globalThis as any).repo) {
  (globalThis as any).repo = repo;
  (globalThis as any).storageAdapter = storageAdapter;
}

// Initialize the root document
const rootDocUrl = getOrCreateRoot(repo);

// Conditionally enable React Strict Mode
const isStrictModeEnabled = import.meta.env.DEV || import.meta.env.VITE_STRICT_MODE === 'true';
console.log('React strict mode:', isStrictModeEnabled);

const AppComponent = (
  <RepoContext.Provider value={repo}>
    <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <App rootDocUrl={rootDocUrl} />
    </HashRouter>
  </RepoContext.Provider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  isStrictModeEnabled ? <StrictMode>{AppComponent}</StrictMode> : AppComponent
)
