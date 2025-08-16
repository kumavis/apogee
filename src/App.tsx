import './App.css'
import { AutomergeUrl, useDocument } from '@automerge/react';
import { deleteRootDoc as removeRootDocFromStorage, RootDocument } from './docs/rootDoc';
import ErrorBoundary from './components/ErrorBoundary';
import RootDocViewer from './components/RootDocViewer';

function App({ rootDocUrl }: { rootDocUrl: AutomergeUrl }) {
  // Get the root document to access worlds
  const [rootDoc] = useDocument<RootDocument>(rootDocUrl, {
    suspense: true,
  });

  const handleDeleteRootDoc = () => {
    removeRootDocFromStorage();
    window.location.reload();
  };
  
  return (
    <div className="App">
      {/* World Selector UI with Error Boundary */}
      <ErrorBoundary>
        {rootDoc && (
          <RootDocViewer rootDoc={rootDoc} onDelete={handleDeleteRootDoc} />
        )}
      </ErrorBoundary>
    </div>
  )
}

export default App
