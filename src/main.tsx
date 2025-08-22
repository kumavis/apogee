import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import {
  Repo,
  WebSocketClientAdapter,
  IndexedDBStorageAdapter,
  RepoContext,
} from "@automerge/react";
import { getOrCreateRoot } from "./docs/rootDoc";
import { HashRouter } from 'react-router-dom';

const repo = new Repo({
  network: [
    new WebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: new IndexedDBStorageAdapter(),
});

// For debugging purposes
if (repo && !(globalThis as any).repo) {
  (globalThis as any).repo = repo;
}

// Initialize the root document
const rootDocUrl = getOrCreateRoot(repo);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RepoContext.Provider value={repo}>
      <HashRouter>
        <App rootDocUrl={rootDocUrl} />
      </HashRouter>
    </RepoContext.Provider>
  </React.StrictMode>
)
