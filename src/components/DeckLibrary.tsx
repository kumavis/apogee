import React, { useState } from 'react';
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { Deck, createDeck } from '../docs/deck';
import { useGameNavigation } from '../hooks/useGameNavigation';

type DeckLibraryProps = {
  rootDoc: RootDocument;
  addDeckToCollection: (deckUrl: AutomergeUrl) => void;
};

type NewDeckForm = {
  name: string;
  description: string;
};

const DeckLibrary: React.FC<DeckLibraryProps> = ({ rootDoc, addDeckToCollection }) => {
  const { navigateToHome, navigateToDeckView } = useGameNavigation();
  const repo = useRepo();
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);
  const [newDeckData, setNewDeckData] = useState<NewDeckForm>({
    name: '',
    description: ''
  });

  const handleCreateDeck = () => {
    if (!newDeckData.name.trim()) {
      alert('Please enter a deck name');
      return;
    }

    // Create the deck document
    const deckData = {
      name: newDeckData.name.trim(),
      description: newDeckData.description.trim() || 'A custom deck',
      cards: [],
      createdBy: rootDoc.selfId
    };

    const deckHandle = createDeck(repo, deckData);

    // Add to root document's deck collection
    addDeckToCollection(deckHandle.url);

    // Reset form and navigate to the new deck
    setShowNewDeckForm(false);
    setNewDeckData({
      name: '',
      description: ''
    });

    // Navigate to the new deck for editing
    navigateToDeckView(deckHandle.url);
  };

  const handleCancelEdit = () => {
    setShowNewDeckForm(false);
    setNewDeckData({
      name: '',
      description: ''
    });
  };

  return (
    <div style={{
      maxWidth: 1200,
      margin: '40px auto',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 24,
      color: '#fff',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      position: 'relative' as const,
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,255,0.6) rgba(0,0,0,0.3)'
    }}>
      <style>
        {`
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.3);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(0,255,255,0.6);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(0,255,255,0.8);
          }
        `}
      </style>

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 32 
      }}>
        <button
          onClick={navigateToHome}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
        >
          ← Back to Menu
        </button>
        <h1 style={{ 
          fontSize: 32, 
          margin: 0, 
          fontWeight: 600,
          background: 'linear-gradient(135deg, #00ffff 0%, #00ff00 50%, #ff4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          🃏 Deck Library
        </h1>
        <button
          onClick={() => setShowNewDeckForm(!showNewDeckForm)}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0px)';
          }}
        >
          + New Deck
        </button>
      </div>

      {/* New Deck Form */}
      {showNewDeckForm && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 32
        }}>
          <h3 style={{ 
            margin: '0 0 24px 0', 
            color: '#00ffff', 
            fontSize: 24,
            textAlign: 'center'
          }}>
            🎨 Create New Deck
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            alignItems: 'start'
          }}>
            {/* Form Fields */}
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 8, 
                  fontSize: 14, 
                  color: '#00ffff',
                  fontWeight: 600
                }}>
                  Deck Name
                </label>
                <input
                  type="text"
                  value={newDeckData.name}
                  onChange={(e) => setNewDeckData(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '2px solid rgba(0,255,255,0.3)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontSize: 16,
                    outline: 'none'
                  }}
                  placeholder="Enter deck name..."
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(0,255,255,0.6)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0,255,255,0.3)';
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 8, 
                  fontSize: 14, 
                  color: '#00ffff',
                  fontWeight: 600
                }}>
                  Description
                </label>
                <textarea
                  value={newDeckData.description}
                  onChange={(e) => setNewDeckData(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '2px solid rgba(0,255,255,0.3)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontSize: 14,
                    minHeight: 80,
                    resize: 'vertical' as const,
                    outline: 'none',
                    lineHeight: 1.4
                  }}
                  placeholder="Describe your deck..."
                />
              </div>


            </div>

            {/* Preview */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,255,255,0.05) 0%, rgba(0,255,0,0.05) 100%)',
              border: '1px solid rgba(0,255,255,0.2)',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center'
            }}>
              <h4 style={{ 
                margin: '0 0 16px 0', 
                color: '#00ffff',
                fontSize: 18
              }}>
                Deck Preview
              </h4>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: 20,
                marginBottom: 16
              }}>
                <h5 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#fff',
                  fontSize: 16
                }}>
                  {newDeckData.name || 'Deck Name'}
                </h5>
                <p style={{ 
                  margin: '0 0 12px 0', 
                  color: '#ccc',
                  fontSize: 14,
                  lineHeight: 1.4
                }}>
                  {newDeckData.description || 'Deck description will appear here...'}
                </p>
                                 <div style={{
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   gap: 8,
                   fontSize: 12,
                   color: '#999'
                 }}>
                   <span>📊 0 cards</span>
                 </div>
              </div>
              <p style={{
                fontSize: 12,
                color: '#00ffff',
                opacity: 0.8,
                margin: 0
              }}>
                You'll be able to add cards after creating the deck
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            justifyContent: 'center',
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid rgba(0,255,255,0.3)'
          }}>
            <button
              onClick={handleCreateDeck}
              disabled={!newDeckData.name.trim()}
              style={{
                background: newDeckData.name.trim() ?
                  'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)' :
                  'rgba(100,100,100,0.3)',
                color: newDeckData.name.trim() ? '#000' : '#666',
                border: 'none',
                padding: '16px 32px',
                borderRadius: 8,
                cursor: newDeckData.name.trim() ? 'pointer' : 'not-allowed',
                fontSize: 16,
                fontWeight: 700,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0,255,0,0.3)'
              }}
              onMouseEnter={(e) => {
                if (newDeckData.name.trim()) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,255,0,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,0,0.3)';
              }}
            >
              🎨 Create Deck
            </button>
            <button
              onClick={handleCancelEdit}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '2px solid rgba(255,255,255,0.3)',
                padding: '16px 32px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Decks List */}
      <div>
        <h2 style={{ 
          fontSize: 20, 
          margin: '0 0 16px 0', 
          color: '#00ffff',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          🃏 Your Decks ({rootDoc.decks.length})
        </h2>
        
        {rootDoc.decks.length === 0 ? (
          <div style={{
            padding: 40,
            textAlign: 'center',
            opacity: 0.6,
            border: '2px dashed rgba(255,255,255,0.2)',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
            <h3 style={{ margin: '0 0 16px 0', color: '#00ffff' }}>
              No decks yet
            </h3>
            <p style={{ margin: '0 0 24px 0', opacity: 0.8 }}>
              Create your first deck to start building your card collection!
            </p>
            <button
              onClick={() => setShowNewDeckForm(true)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
              }}
            >
              + Create First Deck
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20
          }}>
            {rootDoc.decks.map((deckUrl) => (
              <LoadingDeckDisplay 
                key={deckUrl} 
                deckUrl={deckUrl} 
                onDeckSelect={navigateToDeckView}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Component to display a deck from URL
const LoadingDeckDisplay: React.FC<{ 
  deckUrl: AutomergeUrl; 
  onDeckSelect: (deckId: AutomergeUrl) => void;
}> = ({ deckUrl, onDeckSelect }) => {
  const [deck] = useDocument<Deck>(deckUrl, { suspense: false });

  if (!deck) {
    return (
      <div style={{
        padding: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.2)',
        color: '#999',
        textAlign: 'center'
      }}>
        Loading deck...
      </div>
    );
  }

  return (
    <div 
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
      onClick={() => onDeckSelect(deckUrl)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0px)';
        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
      }}
    >
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        height: '100%'
      }}>
                 <div style={{
           display: 'flex',
           justifyContent: 'space-between',
           alignItems: 'flex-start',
           marginBottom: 16
         }}>
           <h3 style={{ 
             margin: 0, 
             color: '#00ffff',
             fontSize: 18,
             fontWeight: 600
           }}>
             {deck.name}
           </h3>
         </div>
        
        <p style={{
          margin: '0 0 16px 0',
          color: '#ccc',
          fontSize: 14,
          lineHeight: 1.4,
          minHeight: 40
        }}>
          {deck.description}
        </p>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#999'
        }}>
          <span>📊 {deck.cards.reduce((total, card) => total + card.quantity, 0)} cards</span>
          <span>🎴 {deck.cards.length} unique</span>
        </div>
        
        <div style={{
          marginTop: 12,
          fontSize: 11,
          color: '#666',
          opacity: 0.7
        }}>
          Updated {new Date(deck.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

export default DeckLibrary;
