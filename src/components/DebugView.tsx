import React, { useState, useEffect } from 'react';
import { useRepo, AutomergeUrl } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';

type DocumentInfo = {
  url: AutomergeUrl;
  type: 'RootDocument' | 'GameDoc' | 'ContactDoc' | 'Deck' | 'CardDefinition' | 'Unknown';
  data: any;
  size: number;
  sizeWithHistory: number;
  isOrphaned?: boolean;
  error?: string;
};

type DebugViewProps = {
  rootDocUrl?: AutomergeUrl;
};

const DebugView: React.FC<DebugViewProps> = ({ rootDocUrl }) => {
  const repo = useRepo();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{loaded: number, total: number} | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);
  const [repoStats, setRepoStats] = useState<{
    totalHandles: number;
    storageStats?: any;
    networkStats?: any;
    memoryStats?: any;
    peerStats?: any;
    orphanedDocuments?: any;
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

  const isValidDocumentId = (id: string): boolean => {
    // Filter out known non-document keys
    const knownNonDocumentKeys = [
      'storage-adapter-id',
      'automerge-repo-id',
      'config',
      'metadata',
      'settings',
      'version'
    ];
    
    if (knownNonDocumentKeys.includes(id)) {
      return false;
    }
    
    // Automerge document IDs are typically base58-encoded strings
    // They're usually around 27-43 characters long and contain only alphanumeric characters
    if (typeof id !== 'string' || id.length < 20 || id.length > 100) {
      return false;
    }
    
    // Check if it contains only valid base58 characters (alphanumeric, no 0, O, I, l)
    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    return base58Regex.test(id);
  };

  const normalizeAutomergeUrl = (urlOrId: string): AutomergeUrl => {
    // If it already has the prefix, return as-is
    if (urlOrId.startsWith('automerge:')) {
      return urlOrId as AutomergeUrl;
    }
    // Otherwise, add the prefix
    return `automerge:${urlOrId}` as AutomergeUrl;
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

  const getStorageAdapterStats = async (storageAdapter: any, storageStats: any) => {
    try {
      console.log('Getting storage adapter statistics...');
      
      // Get all keys using a broad range query
      const allChunks = await storageAdapter.loadRange([]);
      console.log('Storage adapter loadRange result:', allChunks.length, 'chunks');
      
      // Analyze the chunks to get storage statistics
      const documentIds = new Set<string>();
      const chunkTypes = new Map<string, number>();
      let totalStoredSize = 0;
      
      allChunks.forEach((chunk: any) => {
        if (chunk.key && Array.isArray(chunk.key) && chunk.key.length > 0) {
          const docId = chunk.key[0];
          const chunkType = chunk.key[1] || 'unknown';
          
          documentIds.add(docId);
          chunkTypes.set(chunkType, (chunkTypes.get(chunkType) || 0) + 1);
          
          if (chunk.data && chunk.data.length) {
            totalStoredSize += chunk.data.length;
          }
        }
      });
      
      // Store the results
      storageStats.totalChunks = allChunks.length;
      storageStats.uniqueDocuments = documentIds.size;
      storageStats.totalStoredBytes = totalStoredSize;
      storageStats.chunkTypeBreakdown = Object.fromEntries(chunkTypes);
      
      console.log('Storage adapter stats:', {
        totalChunks: allChunks.length,
        uniqueDocuments: documentIds.size,
        totalStoredBytes: totalStoredSize,
        chunkTypes: Object.fromEntries(chunkTypes)
      });
      
    } catch (error) {
      console.error('Error getting storage adapter stats:', error);
      storageStats.storageAdapterError = error instanceof Error ? error.message : 'Unknown error';
    }
  };

  const accessIndexedDBDirectly = async () => {
    try {
      // Try common database names used by Automerge
      const possibleDbNames = ['automerge'];
      const possibleStoreNames = ['documents'];
      
      for (const dbName of possibleDbNames) {
        try {
          console.log(`Trying database: ${dbName}`);
          
          // Open database directly
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });
          
          console.log(`Successfully opened database: ${dbName}`);
          console.log('Object store names:', Array.from(db.objectStoreNames));
          
          // Try to find the right object store
          for (const storeName of possibleStoreNames) {
            if (db.objectStoreNames.contains(storeName)) {
              console.log(`Found object store: ${storeName}`);
              
              const transaction = db.transaction(storeName, 'readonly');
              const objectStore = transaction.objectStore(storeName);
              
              // Get all keys and values
              const keys = await new Promise<any[]>((resolve, reject) => {
                const getAllKeysRequest = objectStore.getAllKeys();
                getAllKeysRequest.onsuccess = () => resolve(getAllKeysRequest.result);
                getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
              });
              
              const values = await new Promise<any[]>((resolve, reject) => {
                const getAllRequest = objectStore.getAll();
                getAllRequest.onsuccess = () => resolve(getAllRequest.result);
                getAllRequest.onerror = () => reject(getAllRequest.error);
              });
              
              db.close();
              
              let totalSize = 0;
              const documents = new Set<string>();
              
              // Analyze keys and filter for valid document URLs
              keys.forEach((key, index) => {
                console.log(`Key ${index}:`, key);
                let potentialDocId = null;
                
                if (Array.isArray(key) && key.length > 0) {
                  potentialDocId = key[0];
                } else if (typeof key === 'string') {
                  potentialDocId = key;
                }
                
                // Filter out non-document keys and normalize URLs
                if (potentialDocId && isValidDocumentId(potentialDocId)) {
                  documents.add(normalizeAutomergeUrl(potentialDocId));
                }
              });
              
              // Calculate total size more accurately
              keys.forEach((key, index) => {
                const value = values[index];
                
                // Count key size (convert to bytes)
                const keySize = new TextEncoder().encode(JSON.stringify(key)).length;
                totalSize += keySize;
                
                // Count value size
                if (value && value.binary && value.binary.length) {
                  // Binary data - this is accurate
                  totalSize += value.binary.length;
                } else if (value && typeof value === 'object') {
                  // Object data - convert to UTF-8 bytes for more accurate measurement
                  const jsonString = JSON.stringify(value);
                  const bytesSize = new TextEncoder().encode(jsonString).length;
                  totalSize += bytesSize;
                } else if (value) {
                  // Other data types
                  const stringValue = String(value);
                  const bytesSize = new TextEncoder().encode(stringValue).length;
                  totalSize += bytesSize;
                }
                
                // Add estimated IndexedDB overhead per record (~100-200 bytes)
                totalSize += 150;
              });
              
              // Calculate breakdown for debugging
              let binarySize = 0;
              let jsonSize = 0;
              let keySize = 0;
              let overheadSize = keys.length * 150;
              
              keys.forEach((key, index) => {
                const value = values[index];
                keySize += new TextEncoder().encode(JSON.stringify(key)).length;
                
                if (value && value.binary && value.binary.length) {
                  binarySize += value.binary.length;
                } else if (value && typeof value === 'object') {
                  const jsonString = JSON.stringify(value);
                  jsonSize += new TextEncoder().encode(jsonString).length;
                } else if (value) {
                  const stringValue = String(value);
                  jsonSize += new TextEncoder().encode(stringValue).length;
                }
              });
              
              console.log(`Direct IndexedDB analysis complete:`, {
                database: dbName,
                store: storeName,
                keyCount: keys.length,
                documentCount: documents.size,
                totalSize,
                breakdown: {
                  binaryData: binarySize,
                  jsonData: jsonSize,
                  keys: keySize,
                  estimatedOverhead: overheadSize
                }
              });
              
              return { keys, totalSize, documents };
            }
          }
          
          db.close();
        } catch (dbError) {
          console.log(`Failed to access database ${dbName}:`, dbError);
        }
      }
      
      console.log('No suitable IndexedDB database found');
      return null;
    } catch (error) {
      console.error('Error in direct IndexedDB access:', error);
      return null;
    }
  };

  const getIndexedDBInfo = async () => {
    try {
      // First, let's inspect the repo structure
      console.log('Repo object:', repo);
      console.log('Repo keys:', Object.keys(repo));
      console.log('Repo prototype:', Object.getPrototypeOf(repo));
      
      const storageSubsystem = (repo as any).storageSubsystem;
      console.log('Storage subsystem in getIndexedDBInfo:', storageSubsystem);
      
      if (!storageSubsystem) {
        console.log('No storage subsystem found');
        return await accessIndexedDBDirectly();
      }
      
      // Try to get storage adapter from global or private field
      const storageAdapter = (globalThis as any).storageAdapter || storageSubsystem['#storageAdapter'];
      
      if (storageAdapter) {
        console.log('Found storage adapter:', storageAdapter.constructor.name);
        console.log('Adapter object:', storageAdapter);
        
        // Check if it's an IndexedDB adapter
        if (storageAdapter.constructor.name !== 'IndexedDBStorageAdapter') {
          console.log('Not an IndexedDB adapter');
          return null;
        }

        // Try to access the database directly using the adapter's configuration
        const databaseName = storageAdapter.database || 'automerge';
        const storeName = storageAdapter.store || 'documents';
        
        console.log('Attempting IndexedDB access with adapter config:', { databaseName, storeName });

        try {
          // Open the database directly
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(databaseName);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
          });

          const transaction = db.transaction(storeName, 'readonly');
          const objectStore = transaction.objectStore(storeName);

          // Get all keys and values
          const keys = await new Promise<any[]>((resolve, reject) => {
            const getAllKeysRequest = objectStore.getAllKeys();
            getAllKeysRequest.onsuccess = () => resolve(getAllKeysRequest.result);
            getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
          });

          const values = await new Promise<any[]>((resolve, reject) => {
            const getAllRequest = objectStore.getAll();
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
          });

          db.close();

          const documents = new Set<string>();
          let totalSize = 0;

          // Analyze keys and filter for valid document URLs
          keys.forEach((key, index) => {
            console.log(`Key ${index}:`, key);
            let potentialDocId = null;
            
            if (Array.isArray(key) && key.length > 0) {
              potentialDocId = key[0];
            } else if (typeof key === 'string') {
              potentialDocId = key;
            }
            
            // Filter out non-document keys and normalize URLs
            if (potentialDocId && isValidDocumentId(potentialDocId)) {
              documents.add(normalizeAutomergeUrl(potentialDocId));
            }
          });

          // Calculate total size more accurately
          keys.forEach((key, index) => {
            const value = values[index];
            
            // Count key size (convert to bytes)
            const keySize = new TextEncoder().encode(JSON.stringify(key)).length;
            totalSize += keySize;
            
            // Count value size
            if (value && value.binary && value.binary.length) {
              // Binary data - this is accurate
              totalSize += value.binary.length;
            } else if (value && typeof value === 'object') {
              // Object data - convert to UTF-8 bytes for more accurate measurement
              const jsonString = JSON.stringify(value);
              const bytesSize = new TextEncoder().encode(jsonString).length;
              totalSize += bytesSize;
            } else if (value) {
              // Other data types
              const stringValue = String(value);
              const bytesSize = new TextEncoder().encode(stringValue).length;
              totalSize += bytesSize;
            }
            
            // Add estimated IndexedDB overhead per record (~100-200 bytes)
            totalSize += 150;
          });
          
          // Calculate breakdown for debugging
          let binarySize = 0;
          let jsonSize = 0;
          let keySize = 0;
          let overheadSize = keys.length * 150;
          
          keys.forEach((key, index) => {
            const value = values[index];
            keySize += new TextEncoder().encode(JSON.stringify(key)).length;
            
            if (value && value.binary && value.binary.length) {
              binarySize += value.binary.length;
            } else if (value && typeof value === 'object') {
              const jsonString = JSON.stringify(value);
              jsonSize += new TextEncoder().encode(jsonString).length;
            } else if (value) {
              const stringValue = String(value);
              jsonSize += new TextEncoder().encode(stringValue).length;
            }
          });
          
          console.log(`IndexedDB analysis via adapter complete:`, {
            database: databaseName,
            store: storeName,
            keyCount: keys.length,
            documentCount: documents.size,
            totalSize,
            breakdown: {
              binaryData: binarySize,
              jsonData: jsonSize,
              keys: keySize,
              estimatedOverhead: overheadSize
            }
          });
          
          return { keys, totalSize, documents };
        } catch (error) {
          console.error('Error accessing IndexedDB via adapter config:', error);
          return await accessIndexedDBDirectly();
        }
      } else {
        console.log('No storage adapter found, using fallback direct access...');
        return await accessIndexedDBDirectly();
      }
    } catch (error) {
      console.error('Error accessing IndexedDB info:', error);
      console.error('Error details:', error);
      return null;
    }
  };

  const findOrphanedDocuments = async () => {
    try {
      console.log('Starting orphaned document analysis...');
      
      // Get all cached document URLs from handle cache
      const allCachedUrls = new Set<string>();
      
      // Try multiple ways to access handles
      let handleCache = (repo as any)['#handleCache'] || (repo as any).handleCache || (repo as any).handles;
      
      // Try accessing through getter
      if (!handleCache && typeof (repo as any).handles === 'function') {
        try {
          handleCache = (repo as any).handles();
        } catch (e) {
          console.log('Failed to call handles() function:', e);
        }
      }
      
      if (handleCache) {
        if (typeof handleCache === 'object') {
          const handleKeys = Object.keys(handleCache);
          console.log('Found handle cache with', handleKeys.length, 'entries');
          handleKeys.forEach(url => allCachedUrls.add(url));
        } else if (Array.isArray(handleCache)) {
          console.log('Found handle cache array with', handleCache.length, 'entries');
          handleCache.forEach((handle: any) => {
            if (handle && handle.url) {
              allCachedUrls.add(handle.url);
            }
          });
        }
      } else {
        console.log('No handle cache found');
        
        // Try inspecting repo structure more thoroughly
        console.log('Repo object keys:', Object.keys(repo));
        console.log('Repo prototype:', Object.getPrototypeOf(repo).constructor.name);
        
        // Try accessing private properties
        const repoKeys = Object.getOwnPropertyNames(repo);
        console.log('All repo properties:', repoKeys);
        
        // Look for anything that might contain document handles
        repoKeys.forEach(key => {
          if (key.includes('handle') || key.includes('cache') || key.includes('doc')) {
            try {
              const value = (repo as any)[key];
              console.log(`Property ${key}:`, typeof value, Array.isArray(value) ? `Array(${value.length})` : '');
            } catch (e) {
              console.log(`Could not access property ${key}`);
            }
          }
        });
      }
      
      // Get comprehensive storage information from IndexedDB
      console.log('Attempting to get IndexedDB info...');
      const indexedDBInfo = await getIndexedDBInfo();
      if (indexedDBInfo) {
        console.log('IndexedDB info retrieved successfully');
        // Add all documents found in IndexedDB storage (they're already normalized)
        indexedDBInfo.documents.forEach(docUrl => allCachedUrls.add(docUrl));
      } else {
        console.log('No IndexedDB info retrieved');
      }
      
      // Also check storage subsystem for stored documents
      if ((repo as any).storageSubsystem && (repo as any).storageSubsystem['#storedHeads']) {
        const storedHeads = (repo as any).storageSubsystem['#storedHeads'];
        console.log('Found stored heads with', storedHeads.size, 'entries');
        for (const docId of storedHeads.keys()) {
          // Filter out non-document IDs and normalize to full URLs
          if (isValidDocumentId(docId)) {
            allCachedUrls.add(normalizeAutomergeUrl(docId));
          }
        }
      } else {
        console.log('No stored heads found');
      }
      
      // Deduplicate URLs (remove any that are the same document with/without prefix)
      const deduplicatedUrls = new Set<string>();
      const seenDocIds = new Set<string>();
      
      for (const url of allCachedUrls) {
        const docId = url.startsWith('automerge:') ? url.substring(10) : url;
        if (!seenDocIds.has(docId)) {
          seenDocIds.add(docId);
          // Always use the full URL format
          deduplicatedUrls.add(url.startsWith('automerge:') ? url : `automerge:${url}`);
        }
      }
      
      console.log('Total cached documents found:', deduplicatedUrls.size, '(deduplicated from', allCachedUrls.size, ')');
      
      // Get all documents referenced in the root document tree
      const referencedUrls = new Set<string>();
      
      if (actualRootDocUrl) {
        referencedUrls.add(actualRootDocUrl);
        
        // Load root document to get its references
        const rootHandle = await repo.find<RootDocument>(actualRootDocUrl);
        if (rootHandle) {
          const rootDoc = rootHandle.doc();
          if (rootDoc) {
            // Add all referenced documents
            referencedUrls.add(rootDoc.selfId);
            rootDoc.games.forEach(url => referencedUrls.add(url));
            rootDoc.cardLibrary.forEach(url => referencedUrls.add(url));
            rootDoc.decks.forEach(url => referencedUrls.add(url));
            
            // Check game documents for additional references
            for (const gameUrl of rootDoc.games) {
              try {
                const gameHandle = await repo.find(gameUrl);
                if (gameHandle) {
                  const gameDoc = gameHandle.doc();
                  if (gameDoc && (gameDoc as any).selectedDeckUrl) {
                    referencedUrls.add((gameDoc as any).selectedDeckUrl);
                  }
                }
              } catch (error) {
                // Ignore errors loading individual game documents
              }
            }
            
            // Check deck documents for card references
            for (const deckUrl of rootDoc.decks) {
              try {
                const deckHandle = await repo.find(deckUrl);
                if (deckHandle) {
                  const deckDoc = deckHandle.doc();
                  if (deckDoc && (deckDoc as any).cards) {
                    const cards = (deckDoc as any).cards;
                    if (Array.isArray(cards)) {
                      cards.forEach((card: any) => {
                        if (card.cardUrl) {
                          referencedUrls.add(card.cardUrl);
                        }
                      });
                    }
                  }
                }
              } catch (error) {
                // Ignore errors loading individual deck documents
              }
            }
          }
        }
      }
      
      // Find orphaned documents (cached but not referenced)
      const orphanedUrls = Array.from(deduplicatedUrls).filter(url => !referencedUrls.has(url));
      
      const orphanedDocs = [];
      for (const url of orphanedUrls) {
        try {
          const handle = await repo.find(url as AutomergeUrl);
          if (handle) {
            const doc = handle.doc();
            if (doc) {
              const type = determineDocumentType(doc);
              const size = calculateSize(doc);
              orphanedDocs.push({
                url,
                type,
                size,
                data: doc
              });
            }
          }
        } catch (error) {
          // Skip documents that can't be loaded - they might be stale cache entries
          console.log(`Skipping unavailable document: ${url}`, error);
        }
      }
      
      return {
        totalCached: deduplicatedUrls.size,
        totalReferenced: referencedUrls.size,
        orphanedCount: orphanedUrls.length,
        orphanedDocs,
        indexedDBInfo
      };
    } catch (error) {
      console.error('Error finding orphaned documents:', error);
      return {
        totalCached: 0,
        totalReferenced: 0,
        orphanedCount: 0,
        orphanedDocs: [],
        indexedDBInfo: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const collectRepoStats = async (existingOrphanAnalysis?: any) => {
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
          console.log('Storage subsystem object:', storageSubsystem);
          console.log('Storage subsystem keys:', Object.keys(storageSubsystem));
          console.log('Storage subsystem properties:', Object.getOwnPropertyNames(storageSubsystem));
          
          stats.storageStats = {
            type: 'StorageSubsystem'
          };
          
          // Try to access storage adapter from global or private field
          let storageAdapter = (globalThis as any).storageAdapter || storageSubsystem['#storageAdapter'];
          
          if (storageAdapter) {
            stats.storageStats.adapterType = storageAdapter.constructor.name;
            console.log('Found storage adapter:', storageAdapter.constructor.name);
            
            // Get additional adapter-specific info
            if (storageAdapter.constructor.name === 'IndexedDBStorageAdapter') {
              try {
                stats.storageStats.databaseName = storageAdapter.database || 'automerge';
                stats.storageStats.storeName = storageAdapter.store || 'documents';
                
                // Use storage adapter to get detailed storage information
                await getStorageAdapterStats(storageAdapter, stats.storageStats);
              } catch (e) {
                console.log('Could not access adapter properties:', e);
              }
            }
          } else {
            stats.storageStats.adapterType = 'Unknown';
            console.log('Could not find storage adapter');
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

      // Use existing orphaned analysis if provided, otherwise compute it
      stats.orphanedDocuments = existingOrphanAnalysis || await findOrphanedDocuments();

      setRepoStats(stats);
    } catch (error) {
      console.error('Error collecting repo stats:', error);
      setRepoStats({
        totalHandles: documents.length,
        storageStats: { error: 'Could not collect storage stats' },
        networkStats: { error: 'Could not collect network stats' },
        memoryStats: { error: 'Could not collect memory stats' },
        peerStats: { error: 'Could not collect peer stats' },
        orphanedDocuments: { error: 'Could not collect orphaned documents' }
      });
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    setDocuments([]); // Clear existing documents for incremental loading
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

      const rootDocInfo: DocumentInfo = {
        url: actualRootDocUrl,
        type: 'RootDocument',
        data: rootDoc,
        size: rootSize,
        sizeWithHistory: rootSizeWithHistory
      };
      
      docInfos.push(rootDocInfo);
      
      // Show root document immediately for quick feedback
      setDocuments([rootDocInfo]);

      // Collect all document URLs from the root document
      const allDocUrls: AutomergeUrl[] = [];
      
      // Add selfId only if it's different from the root document URL
      if (rootDoc.selfId) {
        const normalizedSelfId = normalizeAutomergeUrl(rootDoc.selfId);
        if (normalizedSelfId !== actualRootDocUrl) {
          allDocUrls.push(normalizedSelfId);
        }
      }
      
      // Add other document URLs
      allDocUrls.push(
        ...rootDoc.games, // Game documents
        ...rootDoc.cardLibrary, // Card definition documents
        ...rootDoc.decks // Deck documents
      );

      // Helper function to load a single document
      const loadSingleDocument = async (docUrl: AutomergeUrl): Promise<DocumentInfo | null> => {
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

              return {
                url: docUrl,
                type,
                data: doc,
                size,
                sizeWithHistory
              };
            }
          }
          
          // Document handle not found
          return {
            url: docUrl,
            type: 'Unknown',
            data: {},
            size: 0,
            sizeWithHistory: 0,
            error: 'Document handle not found'
          };
        } catch (error) {
          console.warn(`Could not load document ${docUrl}:`, error);
          return {
            url: docUrl,
            type: 'Unknown',
            data: {},
            size: 0,
            sizeWithHistory: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      };

      // Set up progress tracking
      setLoadingProgress({ loaded: 0, total: allDocUrls.length });
      
      // Load all main documents in parallel
      const documentPromises = allDocUrls.map(loadSingleDocument);
      const documentResults = await Promise.all(documentPromises);
      
      // Add loaded documents to docInfos and update UI incrementally
      let addedCount = 0;
      for (const docInfo of documentResults) {
        if (docInfo) {
          docInfos.push(docInfo);
          addedCount++;
          
          // Update progress
          setLoadingProgress({ loaded: addedCount, total: allDocUrls.length });
          
          // Update UI every 5 documents for incremental rendering
          if (addedCount % 5 === 0 || addedCount === documentResults.length) {
            const currentDocs = [...docInfos].sort((a, b) => {
              if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
              }
              return b.sizeWithHistory - a.sizeWithHistory;
            });
            setDocuments(currentDocs);
          }
        }
      }

      // Handle additional deck references from game documents
      const gameDocuments = docInfos.filter(doc => doc.type === 'GameDoc');
      const additionalDeckUrls: AutomergeUrl[] = [];
      
      for (const gameDoc of gameDocuments) {
        if (gameDoc.data && (gameDoc.data as any).selectedDeckUrl) {
          const selectedDeckUrl = (gameDoc.data as any).selectedDeckUrl;
          if (!allDocUrls.includes(selectedDeckUrl)) {
            additionalDeckUrls.push(selectedDeckUrl);
          }
        }
      }

      // Load additional deck documents in parallel
      if (additionalDeckUrls.length > 0) {
        const additionalDeckPromises = additionalDeckUrls.map(loadSingleDocument);
        const additionalDeckResults = await Promise.all(additionalDeckPromises);
        
        for (const deckInfo of additionalDeckResults) {
          if (deckInfo) {
            docInfos.push(deckInfo);
          }
        }
      }

      // Sort by type, then by size
      docInfos.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return b.sizeWithHistory - a.sizeWithHistory;
      });

      // Mark orphaned documents
      const orphanAnalysis = await findOrphanedDocuments();
      const orphanedUrls = new Set(orphanAnalysis.orphanedDocs.map((doc: any) => doc.url));
      
      // Store the orphaned analysis for reuse in repo stats
      const storedOrphanAnalysis = orphanAnalysis;
      
      // Add orphaned flag to existing documents and add any orphaned docs not already in the list
      const allDocInfos = [...docInfos];
      
      // Mark existing documents as orphaned if they are
      allDocInfos.forEach(doc => {
        doc.isOrphaned = orphanedUrls.has(doc.url);
      });
      
      // Add any orphaned documents that weren't already discovered
      orphanAnalysis.orphanedDocs.forEach((orphanedDoc: any) => {
        // Check if this document already exists in our list (by URL)
        const existingDoc = allDocInfos.find(doc => doc.url === orphanedDoc.url);
        if (!existingDoc) {
          allDocInfos.push({
            url: orphanedDoc.url,
            type: orphanedDoc.type,
            data: orphanedDoc.data,
            size: orphanedDoc.size,
            sizeWithHistory: orphanedDoc.size, // Use same size for orphaned docs
            isOrphaned: true,
            error: orphanedDoc.error
          });
        }
      });
      
      // Sort by orphaned status first (non-orphaned first), then by type, then by size
      allDocInfos.sort((a, b) => {
        if (a.isOrphaned !== b.isOrphaned) {
          return a.isOrphaned ? 1 : -1; // Non-orphaned first
        }
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return b.sizeWithHistory - a.sizeWithHistory;
      });

      setDocuments(allDocInfos);
      
      // Start repository statistics collection in parallel (don't wait for it)
      // Pass the orphaned analysis to avoid duplicating the work
      collectRepoStats(storedOrphanAnalysis).catch(error => 
        console.warn('Error collecting repo stats:', error)
      );
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  useEffect(() => {
    if (actualRootDocUrl) {
      loadDocuments();
    }
  }, [repo, actualRootDocUrl]);

  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
  const totalSizeWithHistory = documents.reduce((sum, doc) => sum + doc.sizeWithHistory, 0);



  if (loading && documents.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#00ffff',
        padding: '20px',
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1>🔍 Debug: Automerge Documents</h1>
          <p>Loading documents from automerge repo...</p>
          {!actualRootDocUrl && (
            <p style={{ color: '#ff4444' }}>Warning: No root document URL found</p>
          )}
          {loadingProgress && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                width: '300px',
                height: '8px',
                backgroundColor: '#333333',
                borderRadius: '4px',
                margin: '0 auto 8px auto',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`,
                  height: '100%',
                  backgroundColor: '#00ffff',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ color: '#00ffff', fontSize: '14px' }}>
                {loadingProgress.loaded} / {loadingProgress.total} documents loaded
              </p>
            </div>
          )}
        </div>
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
            <p style={{ color: totalSizeWithHistory > totalSize * 3 ? '#ff4444' : '#888888' }}>
              <strong>History Overhead:</strong> {Math.round(((totalSizeWithHistory - totalSize) / totalSize) * 100)}%
            </p>
            <div style={{ marginTop: '10px' }}>
              {['RootDocument', 'GameDoc', 'ContactDoc', 'Deck', 'CardDefinition', 'Unknown'].map(type => {
                const count = documents.filter(doc => doc.type === type).length;
                if (count === 0) return null;
                return (
                  <span
                    key={type}
                    style={{
                      color: '#888888',
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
            
            {/* Top Memory Consumers */}
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ fontSize: '14px', color: '#ffaa00', margin: '0 0 8px 0' }}>🔥 Largest Documents</h4>
              {documents
                .sort((a, b) => b.sizeWithHistory - a.sizeWithHistory)
                .slice(0, 5)
                .map((doc, index) => (
                  <div key={doc.url} style={{ fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ color: '#888888' }}>
                      {index + 1}. {doc.type} - {formatBytes(doc.sizeWithHistory)}
                    </span>
                    {doc.sizeWithHistory > doc.size * 2 && (
                      <span style={{ color: '#ff4444', marginLeft: '8px' }}>
                        (⚠️ High history)
                      </span>
                    )}
                  </div>
                ))}
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
                    {repoStats.storageStats.databaseName && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Database: {repoStats.storageStats.databaseName}
                      </div>
                    )}
                    {repoStats.storageStats.storeName && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Store: {repoStats.storageStats.storeName}
                      </div>
                    )}
                    {repoStats.storageStats.documentsStored !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Docs Stored: {repoStats.storageStats.documentsStored}
                      </div>
                    )}
                    {repoStats.storageStats.uniqueDocuments !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Unique Documents: {repoStats.storageStats.uniqueDocuments}
                      </div>
                    )}
                    {repoStats.storageStats.totalChunks !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Total Chunks: {repoStats.storageStats.totalChunks}
                      </div>
                    )}
                    {repoStats.storageStats.totalStoredBytes !== undefined && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Stored Size: {formatBytes(repoStats.storageStats.totalStoredBytes)}
                      </div>
                    )}
                    {repoStats.storageStats.chunkTypeBreakdown && (
                      <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                        Chunk Types: {Object.entries(repoStats.storageStats.chunkTypeBreakdown)
                          .map(([type, count]) => `${type}:${count}`)
                          .join(', ')}
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
                    {repoStats.storageStats.storageAdapterError && (
                      <div style={{ fontSize: '11px', color: '#ff4444', marginLeft: '8px' }}>
                        Adapter Error: {repoStats.storageStats.storageAdapterError}
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
                    <strong>JS Heap Size:</strong>
                    <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                      Used: {formatBytes(repoStats.memoryStats.usedJSHeapSize || 0)}
                    </div>
                    <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                      Total: {formatBytes(repoStats.memoryStats.totalJSHeapSize || 0)}
                    </div>
                  </div>
                )}

                {repoStats.orphanedDocuments && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Cache Analysis:</strong>
                    {repoStats.orphanedDocuments.error ? (
                      <div style={{ fontSize: '11px', color: '#ff4444' }}>
                        Error: {repoStats.orphanedDocuments.error}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                          Cached: {repoStats.orphanedDocuments.totalCached}
                        </div>
                        <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                          Referenced: {repoStats.orphanedDocuments.totalReferenced}
                        </div>
                        <div style={{ fontSize: '11px', marginLeft: '8px', color: '#888888' }}>
                          Orphaned: {repoStats.orphanedDocuments.orphanedCount}
                        </div>
                        {repoStats.orphanedDocuments.indexedDBInfo && (
                          <>
                            <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                              IndexedDB Keys: {repoStats.orphanedDocuments.indexedDBInfo.keys.length}
                            </div>
                            <div style={{ fontSize: '11px', marginLeft: '8px' }}>
                              IndexedDB Size: {formatBytes(repoStats.orphanedDocuments.indexedDBInfo.totalSize)}
                              <span style={{ color: '#888888', fontSize: '10px' }}> (estimated)</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
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
                  <span style={{ color: '#888888', fontWeight: 'bold' }}>
                    {docInfo.isOrphaned && '🔗💔 '}{docInfo.type}
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
                  <h3 style={{ color: '#888888', margin: '0 0 8px 0' }}>
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
                  {selectedDoc.sizeWithHistory > selectedDoc.size * 2 && (
                    <p style={{ fontSize: '12px', color: '#ff4444', margin: '4px 0' }}>
                      ⚠️ High history overhead: {Math.round(((selectedDoc.sizeWithHistory - selectedDoc.size) / selectedDoc.size) * 100)}%
                    </p>
                  )}
                </div>
                
                {/* Game-specific analysis */}
                {selectedDoc.type === 'GameDoc' && selectedDoc.data && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ color: '#ffaa00', margin: '0 0 8px 0', fontSize: '14px' }}>🎮 Game Analysis</h4>
                    <div style={{ fontSize: '12px', color: '#888888' }}>
                      <p><strong>Status:</strong> {selectedDoc.data.status}</p>
                      <p><strong>Turn:</strong> {selectedDoc.data.turn}</p>
                      <p><strong>Game Log Entries:</strong> {selectedDoc.data.gameLog?.length || 0}</p>
                      <p><strong>Card Library Size:</strong> {Object.keys(selectedDoc.data.cardLibrary || {}).length} cards</p>
                      <p><strong>Players:</strong> {selectedDoc.data.players?.length || 0}</p>
                      {selectedDoc.data.gameLog?.length > 100 && (
                        <p style={{ color: '#ff4444' }}>⚠️ Large game log ({selectedDoc.data.gameLog.length} entries) may cause memory bloat</p>
                      )}
                      {Object.keys(selectedDoc.data.cardLibrary || {}).length > 200 && (
                        <p style={{ color: '#ff4444' }}>⚠️ Large card library ({Object.keys(selectedDoc.data.cardLibrary).length} cards) may cause memory bloat</p>
                      )}
                    </div>
                  </div>
                )}
                
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
