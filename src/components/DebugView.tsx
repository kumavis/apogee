import React, { useState, useEffect } from 'react';
import { useRepo, AutomergeUrl } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';

type DocumentInfo = {
  url: AutomergeUrl;
  type: 'RootDocument' | 'GameDoc' | 'ContactDoc' | 'Deck' | 'CardDefinition' | 'Unknown';
  data: any;
  size: number;
  sizeWithHistory: number;
  error?: string;
};

type DebugViewProps = {
  rootDocUrl?: AutomergeUrl;
};

const DebugView: React.FC<DebugViewProps> = ({ rootDocUrl }) => {
  const repo = useRepo();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);
  const [repoStats, setRepoStats] = useState<{
    totalHandles: number;
    storageStats?: any;
    networkStats?: any;
    memoryStats?: any;
    peerStats?: any;
  } | null>(null);
  
  // Get the root document URL from localStorage if not provided
  const actualRootDocUrl = rootDocUrl || (localStorage.getItem('root-doc-url') as AutomergeUrl);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const determineDocumentType = (doc: any): 'RootDocument' | 'GameDoc' | 'ContactDoc' | 'Deck' | 'CardDefinition' | 'Unknown' => {
    if (doc.selfId && doc.games && doc.cardLibrary && doc.decks) {
      return 'RootDocument';
    }
    if (doc.players && doc.status && doc.deck !== undefined && doc.cardLibrary && typeof doc.cardLibrary === 'object') {
      return 'GameDoc';
    }
    if (doc.name && typeof doc.name === 'string' && Object.keys(doc).length <= 3) {
      return 'ContactDoc';
    }
    if (doc.cards && Array.isArray(doc.cards) && doc.name && doc.description) {
      return 'Deck';
    }
    if (doc.cost !== undefined && doc.type && doc.description && doc.isCustom !== undefined) {
      return 'CardDefinition';
    }
    return 'Unknown';
  };

  const calculateSize = (obj: any): number => {
    try {
      const jsonString = JSON.stringify(obj);
      return new Blob([jsonString]).size;
    } catch (error) {
      // Fallback for circular references or other JSON stringify issues
      return JSON.stringify(String(obj)).length;
    }
  };

  const collectRepoStats = async () => {
    try {
      const stats: any = {
        totalHandles: 0,
        storageStats: {},
        networkStats: {},
        memoryStats: {}
      };

      // Count total handles in the repo
      try {
        // Try to access the handle cache directly
        if ((repo as any)['#handleCache']) {
          const handleCache = (repo as any)['#handleCache'];
          stats.totalHandles = handleCache ? Object.keys(handleCache).length : documents.length;
        } else if ((repo as any).handles && typeof (repo as any).handles === 'object') {
          // handles might be a getter property that returns an object
          const handles = (repo as any).handles;
          stats.totalHandles = handles ? Object.keys(handles).length : documents.length;
        } else {
          stats.totalHandles = documents.length;
        }
      } catch (error) {
        console.warn('Could not get handle count:', error);
        stats.totalHandles = documents.length;
      }

      // Access storage subsystem statistics
      if ((repo as any).storageSubsystem) {
        try {
          const storageSubsystem = (repo as any).storageSubsystem;
          stats.storageStats = {
            type: 'StorageSubsystem'
          };
          
          // Check if there's a storage adapter inside the subsystem
          if (storageSubsystem['#storageAdapter']) {
            const adapter = storageSubsystem['#storageAdapter'];
            stats.storageStats.adapterType = adapter.constructor.name;
          }
          
          // Try to get stored heads count (Map of DocumentId -> Heads)
          if (storageSubsystem['#storedHeads'] && storageSubsystem['#storedHeads'].size !== undefined) {
            stats.storageStats.documentsStored = storageSubsystem['#storedHeads'].size;
          }
          
          // Try to get chunk info count (Map of DocumentId -> ChunkInfo[])
          if (storageSubsystem['#chunkInfos'] && storageSubsystem['#chunkInfos'].size !== undefined) {
            stats.storageStats.documentsWithChunks = storageSubsystem['#chunkInfos'].size;
            
            // Calculate total chunks across all documents
            let totalChunks = 0;
            let totalChunkSize = 0;
            try {
              for (const [, chunks] of storageSubsystem['#chunkInfos']) {
                if (Array.isArray(chunks)) {
                  totalChunks += chunks.length;
                  totalChunkSize += chunks.reduce((sum: number, chunk: any) => sum + (chunk.size || 0), 0);
                }
              }
              stats.storageStats.totalChunks = totalChunks;
              stats.storageStats.totalChunkSize = totalChunkSize;
            } catch (e) {
              // Ignore chunk counting errors
            }
          }
          
          // Check if compacting
          if (typeof storageSubsystem['#compacting'] === 'boolean') {
            stats.storageStats.isCompacting = storageSubsystem['#compacting'];
          }
        } catch (error) {
          stats.storageStats.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // Access network subsystem statistics
      if ((repo as any).networkSubsystem) {
        try {
          const networkSubsystem = (repo as any).networkSubsystem;
          stats.networkStats = {
            type: 'NetworkSubsystem'
          };
          
          // Get session ID (should be available)
          if (networkSubsystem['#sessionId']) {
            stats.networkStats.sessionId = networkSubsystem['#sessionId'];
          }
          
          // Get message count
          if (networkSubsystem['#count'] !== undefined) {
            stats.networkStats.messageCount = networkSubsystem['#count'];
          }
          
          // Get peer ID from the subsystem
          if (networkSubsystem.peerId) {
            stats.networkStats.peerId = networkSubsystem.peerId;
          }
          
          // Get adapters count
          if (networkSubsystem.adapters && Array.isArray(networkSubsystem.adapters)) {
            stats.networkStats.adapterCount = networkSubsystem.adapters.length;
            stats.networkStats.adapters = networkSubsystem.adapters.map((adapter: any) => ({
              type: adapter?.constructor?.name || 'Unknown',
              isReady: adapter?.isReady ? adapter.isReady() : false
            }));
          }
          
          // Get adapters by peer info
          if (networkSubsystem['#adaptersByPeer']) {
            const adaptersByPeer = networkSubsystem['#adaptersByPeer'];
            stats.networkStats.connectedPeers = Object.keys(adaptersByPeer).length;
            stats.networkStats.peerConnections = Object.entries(adaptersByPeer).map(([peerId, adapter]: [string, any]) => ({
              peerId: peerId.substring(0, 12) + '...',
              adapterType: adapter?.constructor?.name || 'Unknown'
            }));
          }
          
          // Get ephemeral session counts
          if (networkSubsystem['#ephemeralSessionCounts']) {
            stats.networkStats.ephemeralSessions = Object.keys(networkSubsystem['#ephemeralSessionCounts']).length;
          }
        } catch (error) {
          stats.networkStats.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // Get peer metadata
      if ((repo as any).peerMetadataByPeerId) {
        try {
          const peerMetadata = (repo as any).peerMetadataByPeerId;
          stats.peerStats = {
            totalPeers: Object.keys(peerMetadata).length,
            peers: Object.entries(peerMetadata).map(([peerId, metadata]: [string, any]) => ({
              peerId,
              metadata: metadata || {}
            }))
          };
        } catch (error) {
          console.warn('Could not access peer metadata:', error);
        }
      }

      // Memory usage statistics (basic estimates)
      if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
        const memory = (window.performance as any).memory;
        stats.memoryStats = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      }

      setRepoStats(stats);
    } catch (error) {
      console.error('Error collecting repo stats:', error);
      setRepoStats({
        totalHandles: documents.length,
        storageStats: { error: 'Could not collect storage stats' },
        networkStats: { error: 'Could not collect network stats' },
        memoryStats: { error: 'Could not collect memory stats' },
        peerStats: { error: 'Could not collect peer stats' }
      });
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    const docInfos: DocumentInfo[] = [];

    try {
      if (!actualRootDocUrl) {
        throw new Error('No root document URL found');
      }

      // First, load the root document to get all other document URLs
      const rootHandle = await repo.find<RootDocument>(actualRootDocUrl);
      if (!rootHandle) {
        throw new Error('Root document not found');
      }

      const rootDoc = rootHandle.doc();
      if (!rootDoc) {
        throw new Error('Root document data not available');
      }

      // Add the root document itself
      const rootSize = calculateSize(rootDoc);
      let rootSizeWithHistory = rootSize;
      try {
        // Try to get binary representation for size with history
        if (typeof (rootHandle as any).save === 'function') {
          const binary = (rootHandle as any).save();
          rootSizeWithHistory = binary ? binary.length : rootSize;
        }
      } catch (e) {
        rootSizeWithHistory = rootSize;
      }

      docInfos.push({
        url: actualRootDocUrl,
        type: 'RootDocument',
        data: rootDoc,
        size: rootSize,
        sizeWithHistory: rootSizeWithHistory
      });

      // Collect all document URLs from the root document
      const allDocUrls: AutomergeUrl[] = [
        rootDoc.selfId, // Contact document
        ...rootDoc.games, // Game documents
        ...rootDoc.cardLibrary, // Card definition documents
        ...rootDoc.decks // Deck documents
      ];

      // Load each document
      for (const docUrl of allDocUrls) {
        try {
          const handle = await repo.find(docUrl);
          if (handle) {
            const doc = handle.doc();
            if (doc) {
              const type = determineDocumentType(doc);
              const size = calculateSize(doc);
              
              // Try to estimate size with history by getting the binary representation
              let sizeWithHistory = size;
              try {
                if (typeof (handle as any).save === 'function') {
                  const binary = (handle as any).save();
                  sizeWithHistory = binary ? binary.length : size;
                }
              } catch (e) {
                // Fallback to document size if can't get binary
                sizeWithHistory = size;
              }

              docInfos.push({
                url: docUrl,
                type,
                data: doc,
                size,
                sizeWithHistory
              });

              // If this is a game document, check for additional deck references
              if (type === 'GameDoc' && (doc as any).selectedDeckUrl) {
                try {
                  const selectedDeckUrl = (doc as any).selectedDeckUrl;
                  const deckHandle = await repo.find(selectedDeckUrl);
                  if (deckHandle) {
                    const deckDoc = deckHandle.doc();
                    if (deckDoc && !allDocUrls.includes(selectedDeckUrl)) {
                      const deckType = determineDocumentType(deckDoc);
                      const deckSize = calculateSize(deckDoc);
                      let deckSizeWithHistory = deckSize;
                      try {
                        if (typeof (deckHandle as any).save === 'function') {
                          const binary = (deckHandle as any).save();
                          deckSizeWithHistory = binary ? binary.length : deckSize;
                        }
                      } catch (e) {
                        deckSizeWithHistory = deckSize;
                      }

                      docInfos.push({
                        url: selectedDeckUrl,
                        type: deckType,
                        data: deckDoc,
                        size: deckSize,
                        sizeWithHistory: deckSizeWithHistory
                      });
                    }
                  }
                } catch (error) {
                  console.warn(`Could not load game deck ${(doc as any).selectedDeckUrl}:`, error);
                }
              }
            }
          } else {
            // Document handle not found
            docInfos.push({
              url: docUrl,
              type: 'Unknown',
              data: {},
              size: 0,
              sizeWithHistory: 0,
              error: 'Document handle not found'
            });
          }
        } catch (error) {
          console.error(`Error processing document ${docUrl}:`, error);
          docInfos.push({
            url: docUrl,
            type: 'Unknown',
            data: {},
            size: 0,
            sizeWithHistory: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Sort by type, then by size
      docInfos.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return b.sizeWithHistory - a.sizeWithHistory;
      });

      setDocuments(docInfos);
      
      // Collect repository statistics after loading documents
      await collectRepoStats();
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (actualRootDocUrl) {
      loadDocuments();
    }
  }, [repo, actualRootDocUrl]);

  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
  const totalSizeWithHistory = documents.reduce((sum, doc) => sum + doc.sizeWithHistory, 0);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'RootDocument': return '#00ffff';
      case 'GameDoc': return '#00ff00';
      case 'ContactDoc': return '#ffff00';
      case 'Deck': return '#ff8800';
      case 'CardDefinition': return '#ff4444';
      default: return '#888888';
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#00ffff',
        padding: '20px',
        fontFamily: 'monospace'
      }}>
        <h1>🔍 Debug: Automerge Documents</h1>
        <p>Loading documents from automerge repo...</p>
        {!actualRootDocUrl && (
          <p style={{ color: '#ff4444' }}>Warning: No root document URL found</p>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#00ffff',
      padding: '20px',
      fontFamily: 'monospace'
    }}>
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1>🔍 Debug: Automerge Documents</h1>
        <button
          onClick={() => {
            loadDocuments();
            if (repoStats) {
              collectRepoStats();
            }
          }}
          style={{
            backgroundColor: '#003333',
            color: '#00ffff',
            border: '1px solid #00ffff',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh All
        </button>
      </div>

      <div style={{
        backgroundColor: '#111111',
        border: '1px solid #333333',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h2>📊 Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Document Statistics */}
          <div>
            <h3 style={{ fontSize: '16px', color: '#00ffff', margin: '0 0 12px 0' }}>📄 Documents</h3>
            <p><strong>Total Documents:</strong> {documents.length}</p>
            <p><strong>Total Size (Data Only):</strong> {formatBytes(totalSize)}</p>
            <p><strong>Total Size (With History):</strong> {formatBytes(totalSizeWithHistory)}</p>
            <div style={{ marginTop: '10px' }}>
              {['RootDocument', 'GameDoc', 'ContactDoc', 'Deck', 'CardDefinition', 'Unknown'].map(type => {
                const count = documents.filter(doc => doc.type === type).length;
                if (count === 0) return null;
                return (
                  <span
                    key={type}
                    style={{
                      color: getTypeColor(type),
                      marginRight: '16px',
                      fontSize: '12px',
                      display: 'block'
                    }}
                  >
                    {type}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Repository Statistics */}
          <div>
            <h3 style={{ fontSize: '16px', color: '#00ff00', margin: '0 0 12px 0' }}>🏛️ Repository</h3>
            {repoStats ? (
              <>
                <p><strong>Total Handles:</strong> {repoStats.totalHandles}</p>
                
                {repoStats.storageStats && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Storage:</strong> {repoStats.storageStats.adapterType || 'Unknown'}
                    {repoStats.storageStats.documentsStored !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Docs Stored: {repoStats.storageStats.documentsStored}
                      </div>
                    )}
                    {repoStats.storageStats.totalChunks !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Total Chunks: {repoStats.storageStats.totalChunks}
                      </div>
                    )}
                    {repoStats.storageStats.totalChunkSize !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Chunk Size: {formatBytes(repoStats.storageStats.totalChunkSize)}
                      </div>
                    )}
                    {repoStats.storageStats.isCompacting !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Compacting: {repoStats.storageStats.isCompacting ? 'Yes' : 'No'}
                      </div>
                    )}
                    {repoStats.storageStats.error && (
                      <div style={{ fontSize: '11px', color: '#ff4444' }}>
                        Error: {repoStats.storageStats.error}
                      </div>
                    )}
                  </div>
                )}
                
                {repoStats.networkStats && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Network:</strong> {repoStats.networkStats.type || 'Unknown'}
                    {repoStats.networkStats.sessionId && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Session: {repoStats.networkStats.sessionId.substring(0, 8)}...
                      </div>
                    )}
                    {repoStats.networkStats.peerId && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Peer ID: {repoStats.networkStats.peerId.substring(0, 12)}...
                      </div>
                    )}
                    {repoStats.networkStats.messageCount !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Messages Sent: {repoStats.networkStats.messageCount}
                      </div>
                    )}
                    {repoStats.networkStats.adapterCount !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Adapters: {repoStats.networkStats.adapterCount}
                      </div>
                    )}
                    {repoStats.networkStats.connectedPeers !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Connected Peers: {repoStats.networkStats.connectedPeers}
                      </div>
                    )}
                    {repoStats.networkStats.adapters && repoStats.networkStats.adapters.map((adapter: any, i: number) => (
                      <div key={i} style={{ fontSize: '11px', marginLeft: '8px' }}>
                        {adapter.type}: {adapter.isReady ? 'Ready' : 'Not Ready'}
                      </div>
                    ))}
                    {repoStats.networkStats.error && (
                      <div style={{ fontSize: '11px', color: '#ff4444' }}>
                        Error: {repoStats.networkStats.error}
                      </div>
                    )}
                  </div>
                )}

                {repoStats.peerStats && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Peers:</strong> {repoStats.peerStats.totalPeers}
                    {repoStats.peerStats.peers && repoStats.peerStats.peers.map((peer: any, i: number) => (
                      <div key={i} style={{ fontSize: '11px', marginLeft: '8px' }}>
                        {peer.peerId.substring(0, 12)}...
                      </div>
                    ))}
                  </div>
                )}
                
                {repoStats.memoryStats && !repoStats.memoryStats.error && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Memory:</strong>
                    <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                      Used: {formatBytes(repoStats.memoryStats.usedJSHeapSize || 0)}
                    </div>
                    <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                      Total: {formatBytes(repoStats.memoryStats.totalJSHeapSize || 0)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: '12px', color: '#888888' }}>Loading repository stats...</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Document List */}
        <div style={{ flex: '1', maxWidth: '50%' }}>
          <h2>📄 Documents</h2>
          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #333333',
            borderRadius: '8px',
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            {documents.map((docInfo, index) => (
              <div
                key={docInfo.url}
                onClick={() => setSelectedDoc(docInfo)}
                style={{
                  padding: '12px',
                  borderBottom: index < documents.length - 1 ? '1px solid #333333' : 'none',
                  cursor: 'pointer',
                  backgroundColor: selectedDoc?.url === docInfo.url ? '#222222' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 
                  selectedDoc?.url === docInfo.url ? '#222222' : 'transparent'}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  <span style={{ color: getTypeColor(docInfo.type), fontWeight: 'bold' }}>
                    {docInfo.type}
                  </span>
                  <span style={{ fontSize: '12px', color: '#888888' }}>
                    {formatBytes(docInfo.sizeWithHistory)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666666', wordBreak: 'break-all' }}>
                  {docInfo.url}
                </div>
                {docInfo.error && (
                  <div style={{ fontSize: '11px', color: '#ff4444', marginTop: '4px' }}>
                    Error: {docInfo.error}
                  </div>
                )}
                {docInfo.type === 'RootDocument' && (
                  <div style={{ fontSize: '11px', color: '#888888', marginTop: '4px' }}>
                    Games: {docInfo.data.games?.length || 0}, Cards: {docInfo.data.cardLibrary?.length || 0}, Decks: {docInfo.data.decks?.length || 0}
                  </div>
                )}
                {docInfo.type === 'GameDoc' && (
                  <div style={{ fontSize: '11px', color: '#888888', marginTop: '4px' }}>
                    Status: {docInfo.data.status}, Players: {docInfo.data.players?.length || 0}, Turn: {docInfo.data.turn || 0}
                  </div>
                )}
                {docInfo.type === 'ContactDoc' && (
                  <div style={{ fontSize: '11px', color: '#888888', marginTop: '4px' }}>
                    Name: {docInfo.data.name}
                  </div>
                )}
                {docInfo.type === 'Deck' && (
                  <div style={{ fontSize: '11px', color: '#888888', marginTop: '4px' }}>
                    Name: {docInfo.data.name}, Cards: {docInfo.data.cards?.length || 0}
                  </div>
                )}
                {docInfo.type === 'CardDefinition' && (
                  <div style={{ fontSize: '11px', color: '#888888', marginTop: '4px' }}>
                    Name: {docInfo.data.name}, Cost: {docInfo.data.cost}, Type: {docInfo.data.type}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Document Details */}
        <div style={{ flex: '1', maxWidth: '50%' }}>
          <h2>📋 Document Data</h2>
          <div style={{
            backgroundColor: '#111111',
            border: '1px solid #333333',
            borderRadius: '8px',
            padding: '16px',
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            {selectedDoc ? (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ color: getTypeColor(selectedDoc.type), margin: '0 0 8px 0' }}>
                    {selectedDoc.type}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#888888', margin: '4px 0', wordBreak: 'break-all' }}>
                    <strong>URL:</strong> {selectedDoc.url}
                  </p>
                  <p style={{ fontSize: '12px', color: '#888888', margin: '4px 0' }}>
                    <strong>Size (Data):</strong> {formatBytes(selectedDoc.size)}
                  </p>
                  <p style={{ fontSize: '12px', color: '#888888', margin: '4px 0' }}>
                    <strong>Size (With History):</strong> {formatBytes(selectedDoc.sizeWithHistory)}
                  </p>
                </div>
                <div style={{
                  backgroundColor: '#000000',
                  border: '1px solid #333333',
                  borderRadius: '4px',
                  padding: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto'
                }}>
                  {(() => {
                    try {
                      return JSON.stringify(selectedDoc.data, null, 2);
                    } catch (error) {
                      return `Error serializing document: ${error instanceof Error ? error.message : 'Unknown error'}\n\nDocument: ${String(selectedDoc.data)}`;
                    }
                  })()}
                </div>
              </>
            ) : (
              <p style={{ color: '#888888', fontStyle: 'italic' }}>
                Select a document from the list to view its data
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugView;
