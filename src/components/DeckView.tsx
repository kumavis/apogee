import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { Deck, cloneDeck } from '../docs/deck';
import { CardDefinition } from '../docs/cardDefinition';
import { GameCard } from '../docs/game';
import { RootDocument } from '../docs/rootDoc';
import { ContactDoc } from '../docs/contact';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Card from './Card';

type DeckViewProps = {
  rootDoc: RootDocument;
  addDeckToCollection: (deckUrl: AutomergeUrl) => void;
};

type DeckViewParams = {
  deckId: string;
};

const DeckView: React.FC<DeckViewProps> = ({ rootDoc, addDeckToCollection }) => {
  const { deckId } = useParams<DeckViewParams>();
  const navigate = useNavigate();
  const { navigateToHome, navigateToDeckLibrary, navigateToCardEdit, navigateToCardView, navigateToCardLibrary } = useGameNavigation();
  const repo = useRepo();

  const [showCloneForm, setShowCloneForm] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  // Get the deck document
  const [deck, changeDeck] = useDocument<Deck>(deckId as AutomergeUrl, { suspense: false });

  if (!deck) {
    return (
      <div style={{
        maxWidth: 1200,
        margin: '20px auto',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        padding: 24,
        color: '#fff',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2>Loading deck...</h2>
      </div>
    );
  }

  // Check if this deck is in the user's collection
  const isInCollection = rootDoc.decks.includes(deckId as AutomergeUrl);
  const isOwner = deck.createdBy === rootDoc.selfId;

  const handleAddCard = (cardUrl: AutomergeUrl) => {
    // Update the deck document
    const deckHandle = repo.find(deckId as AutomergeUrl);
    if (deckHandle) {
      deckHandle.then((handle) => {
        if (handle) {
          handle.change((doc: any) => {
            const existingCard = doc.cards.find((card: any) => card.cardUrl === cardUrl);

            if (existingCard) {
              // Update existing card quantity
              existingCard.quantity += 1;
            } else {
              // Add new card
              doc.cards.push({
                cardUrl: cardUrl,
                quantity: 1
              });
            }

            doc.updatedAt = new Date().toISOString();
          });
        }
      });
    }
  };

  const handleRemoveCard = (cardUrl: AutomergeUrl, quantity: number = 1) => {
    const deckHandle = repo.find(deckId as AutomergeUrl);
    if (deckHandle) {
      deckHandle.then((handle) => {
        if (handle) {
          handle.change((doc: any) => {
            const existingCard = doc.cards.find((card: any) => card.cardUrl === cardUrl);

            if (existingCard) {
              if (existingCard.quantity <= quantity) {
                // Remove card entirely
                doc.cards = doc.cards.filter((card: any) => card.cardUrl !== cardUrl);
              } else {
                // Reduce quantity
                existingCard.quantity -= quantity;
              }

              doc.updatedAt = new Date().toISOString();
            }
          });
        }
      });
    }
  };

  const handleUpdateCardQuantity = (cardUrl: AutomergeUrl, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveCard(cardUrl);
      return;
    }

    const deckHandle = repo.find(deckId as AutomergeUrl);
    if (deckHandle) {
      deckHandle.then((handle) => {
        if (handle) {
          handle.change((doc: any) => {
            const existingCard = doc.cards.find((card: any) => card.cardUrl === cardUrl);

            if (existingCard) {
              existingCard.quantity = newQuantity;
              doc.updatedAt = new Date().toISOString();
            }
          });
        }
      });
    }
  };

  const handleCloneDeck = () => {
    if (!cloneName.trim()) return;

    const deckData = cloneDeck(deck, cloneName.trim());
    const newDeckHandle = repo.create<Deck>({
      ...deckData,
      id: `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Add to user's collection
    addDeckToCollection(newDeckHandle.url);

    // Reset form and navigate to new deck
    setShowCloneForm(false);
    setCloneName('');
    navigate(`/deck/${newDeckHandle.url}`);
  };

  const handleStartRename = () => {
    setNewName(deck.name);
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setNewName('');
  };

  const handleSaveRename = () => {
    if (!newName.trim()) {
      alert('Please enter a deck name');
      return;
    }

    changeDeck((doc) => {
      doc.name = newName.trim();
      doc.updatedAt = new Date().toISOString();
    });

    setIsRenaming(false);
    setNewName('');
  };

  const handleStartEditDescription = () => {
    setNewDescription(deck.description);
    setIsEditingDescription(true);
  };

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
    setNewDescription('');
  };

  const handleSaveDescription = () => {
    changeDeck((doc) => {
      doc.description = newDescription.trim() || 'A custom deck';
      doc.updatedAt = new Date().toISOString();
    });

    setIsEditingDescription(false);
    setNewDescription('');
  };

  const handleAddToCollection = () => {
    addDeckToCollection(deckId as AutomergeUrl);
  };

  const totalCards = deck.cards.reduce((total, card) => total + card.quantity, 0);
  const uniqueCards = deck.cards.length;

  return (
    <div style={{
      maxWidth: 1200,
      margin: '20px auto',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 24,
      color: '#fff',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      position: 'relative' as const
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
            ← Home
          </button>
          <button
            onClick={navigateToDeckLibrary}
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
            📚 Decks
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            {isRenaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') handleCancelRename();
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '2px solid #00ffff',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 28,
                    fontWeight: 600,
                    textAlign: 'center',
                    minWidth: 300,
                    outline: 'none'
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveRename}
                  style={{
                    background: '#00ff00',
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelRename}
                  style={{
                    background: '#ff4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <h1 style={{
                  fontSize: 32,
                  margin: 0,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #00ffff 0%, #00ff00 50%, #ff4444 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  {deck.name}
                </h1>
                {isOwner && (
                  <button
                    onClick={handleStartRename}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: 12,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    }}
                    title="Rename deck"
                  >
                    ✏️
                  </button>
                )}
              </>
            )}
          </div>
          <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              fontSize: 14,
              color: '#ccc'
            }}>
              <span>📊 {totalCards} cards</span>
              <span>🎴 {uniqueCards} unique</span>
              {!isOwner && <span>👤 Shared by <DeckAuthorName authorId={deck.createdBy} /></span>}
            </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {!isInCollection && (
            <button
              onClick={handleAddToCollection}
              style={{
                background: 'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)',
                color: '#000',
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
              ➕ Add to Collection
            </button>
          )}

          <button
            onClick={() => setShowCloneForm(true)}
            style={{
              background: 'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)',
              color: '#000',
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
            📋 Clone
          </button>

        </div>
      </div>

      {/* Description */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        textAlign: 'center'
      }}>
        {isEditingDescription ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleSaveDescription();
                if (e.key === 'Escape') handleCancelEditDescription();
              }}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '2px solid #00ffff',
                borderRadius: 8,
                padding: '12px',
                color: '#fff',
                fontSize: 16,
                lineHeight: 1.5,
                width: '100%',
                minHeight: 80,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              placeholder="Enter deck description..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSaveDescription}
                style={{
                  background: '#00ff00',
                  color: '#000',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                ✓ Save
              </button>
              <button
                onClick={handleCancelEditDescription}
                style={{
                  background: '#ff4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                ✕ Cancel
              </button>
            </div>
            <p style={{ margin: 0, color: '#999', fontSize: 12 }}>
              Press Ctrl+Enter to save, Escape to cancel
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 8 }}>
              <p style={{ margin: 0, color: '#ccc', fontSize: 16, lineHeight: 1.5, flex: 1 }}>
                {deck.description}
              </p>
              {isOwner && (
                <button
                  onClick={handleStartEditDescription}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  title="Edit description"
                >
                  ✏️
                </button>
              )}
            </div>
            {!isOwner && (
              <p style={{ margin: '8px 0 0 0', color: '#999', fontSize: 14 }}>
                Created by <DeckAuthorName authorId={deck.createdBy} />
              </p>
            )}
          </div>
        )}
      </div>

      {/* Clone Deck Form */}
      {showCloneForm && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            color: '#ffaa00',
            fontSize: 20,
            textAlign: 'center'
          }}>
            📋 Clone Deck
          </h3>

          <div style={{ textAlign: 'center' }}>
            <label style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 14,
              color: '#ffaa00',
              fontWeight: 600
            }}>
              New Deck Name
            </label>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '12px 16px',
                borderRadius: 8,
                border: '2px solid rgba(255,170,0,0.3)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: 16,
                outline: 'none',
                marginBottom: 20
              }}
              placeholder="Enter new deck name..."
            />

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button
                onClick={handleCloneDeck}
                disabled={!cloneName.trim()}
                style={{
                  background: cloneName.trim() ?
                    'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)' :
                    'rgba(100,100,100,0.3)',
                  color: cloneName.trim() ? '#000' : '#666',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: 8,
                  cursor: cloneName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 14,
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                Clone Deck
              </button>
              <button
                onClick={() => setShowCloneForm(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '12px 24px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div style={{
        marginBottom: 24,
      }}>
        <h2 style={{
          fontSize: 20,
          margin: '0 0 16px 0',
          color: '#00ffff',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          🎴 Cards ({totalCards})
        </h2>

        {deck.cards.length === 0 ? (
          <div style={{
            padding: 40,
            textAlign: 'center',
            opacity: 0.6,
            border: '2px dashed rgba(255,255,255,0.2)',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎴</div>
            <h3 style={{ margin: '0 0 16px 0', color: '#00ffff' }}>
              No cards yet
            </h3>
            <p style={{ margin: '0 0 24px 0', opacity: 0.8 }}>
              Click on cards below to add them to your deck!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16
          }}>
            {deck.cards.map((deckCard) => (
              <DeckCardDisplay
                key={deckCard.cardUrl}
                deckCard={deckCard}
                onRemoveCard={handleRemoveCard}
                onUpdateQuantity={handleUpdateCardQuantity}
                onEditCard={navigateToCardEdit}
                onViewCard={navigateToCardView}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available Cards to Add */}
      <div style={{
        marginBottom: 24
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <h2 style={{
            fontSize: 20,
            margin: 0,
            color: '#00ffff',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            🎴 Available Cards to Add
          </h2>
          
          <button
            onClick={navigateToCardLibrary}
            style={{
              background: 'linear-gradient(135deg, #00ffff 0%, #0088ff 100%)',
              color: '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,255,255,0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,255,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,255,255,0.3)';
            }}
          >
            📚 Go to Card Library
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
          justifyContent: 'center'
        }}>
          {rootDoc.cardLibrary.map((cardUrl) => (
            <AvailableCardDisplay
              key={cardUrl}
              cardUrl={cardUrl}
              onAddCard={handleAddCard}
              onEditCard={navigateToCardEdit}
              onViewCard={navigateToCardView}
              currentQuantity={deck.cards.find(card => card.cardUrl === cardUrl)?.quantity || 0}
            />
          ))}
        </div>

        {rootDoc.cardLibrary.length === 0 && (
          <div style={{
            padding: 20,
            textAlign: 'center',
            opacity: 0.6,
            color: '#999'
          }}>
            No custom cards available. Create some cards in the Card Library first!
          </div>
        )}
      </div>

    </div>
  );
};

// Component to display an available card that can be added to the deck
const AvailableCardDisplay: React.FC<{
  cardUrl: AutomergeUrl;
  onAddCard: (cardUrl: AutomergeUrl) => void;
  currentQuantity: number;
  onEditCard: (cardUrl: AutomergeUrl) => void;
  onViewCard: (cardUrl: AutomergeUrl) => void;
}> = ({ cardUrl, onAddCard, currentQuantity, onEditCard, onViewCard }) => {
  const [cardDef] = useDocument<CardDefinition>(cardUrl, { suspense: false });

  if (!cardDef) {
    return (
      <div style={{
        padding: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.2)',
        color: '#999',
        textAlign: 'center'
      }}>
        Loading...
      </div>
    );
  }

  // Convert CardDefinition to GameCard format for Card component
  const gameCard: GameCard = {
    id: cardDef.id,
    name: cardDef.name,
    cost: cardDef.cost,
    attack: cardDef.attack,
    health: cardDef.health,
    type: cardDef.type,
    description: cardDef.description,
    spellEffect: cardDef.spellEffect,
    triggeredAbilities: cardDef.triggeredAbilities,
    renderer: cardDef.renderer || null
  };

  return (
    <div
      style={{
        transition: 'all 0.2s ease',
        position: 'relative',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 8
      }}
    >
      {/* Card Display */}
      <div style={{ marginBottom: 8 }}>
        <Card card={gameCard} />
      </div>

      {/* Buttons and Quantity Info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '0 4px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddCard(cardUrl);
            }}
            style={{
              background: 'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)',
              color: '#000',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flex: 1,
              marginRight: 8
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            ➕ Add
          </button>

          {currentQuantity > 0 && (
            <span style={{
              fontSize: 12,
              color: '#00ffff',
              fontWeight: 600,
              background: 'rgba(0,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: 4,
              minWidth: 20,
              textAlign: 'center'
            }}>
              {currentQuantity}
            </span>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          gap: 4
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditCard(cardUrl);
            }}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            ✏️ Edit
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewCard(cardUrl);
            }}
            style={{
              background: 'linear-gradient(135deg, #00ffff 0%, #0088ff 100%)',
              color: '#000',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            👁️ View
          </button>
        </div>
      </div>
    </div>
  );
};

// Component to display a card in the deck
const DeckCardDisplay: React.FC<{
  deckCard: { cardUrl: AutomergeUrl; quantity: number };
  onRemoveCard: (cardUrl: AutomergeUrl, quantity?: number) => void;
  onUpdateQuantity: (cardUrl: AutomergeUrl, quantity: number) => void;
  onEditCard: (cardUrl: AutomergeUrl) => void;
  onViewCard: (cardUrl: AutomergeUrl) => void;
}> = ({ deckCard, onRemoveCard, onUpdateQuantity, onEditCard, onViewCard }) => {
  const [cardDef] = useDocument<CardDefinition>(deckCard.cardUrl, { suspense: false });

  if (!cardDef) {
    return (
      <div style={{
        padding: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.2)',
        color: '#999',
        textAlign: 'center'
      }}>
        Loading card...
      </div>
    );
  }

  // Convert CardDefinition to GameCard format for Card component
  const gameCard: GameCard = {
    id: cardDef.id,
    name: cardDef.name,
    cost: cardDef.cost,
    attack: cardDef.attack,
    health: cardDef.health,
    type: cardDef.type,
    description: cardDef.description,
    spellEffect: cardDef.spellEffect,
    triggeredAbilities: cardDef.triggeredAbilities,
    renderer: cardDef.renderer || null
  };

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: 12,
      transition: 'all 0.2s ease'
    }}>
      {/* Card Display */}
      <div style={{ marginBottom: 12 }}>
        <Card card={gameCard} />
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        {/* Quantity Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ fontSize: 14, color: '#00ffff', fontWeight: 600 }}>
              Qty: {deckCard.quantity}
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => onUpdateQuantity(deckCard.cardUrl, deckCard.quantity - 1)}
                style={{
                  width: 24,
                  height: 24,
                  background: 'rgba(255,100,100,0.3)',
                  border: '1px solid rgba(255,100,100,0.5)',
                  borderRadius: '50%',
                  color: '#ff6666',
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                -
              </button>
              <button
                onClick={() => onUpdateQuantity(deckCard.cardUrl, deckCard.quantity + 1)}
                disabled={deckCard.quantity >= 10}
                style={{
                  width: 24,
                  height: 24,
                  background: deckCard.quantity < 10 ? 'rgba(100,255,100,0.3)' : 'rgba(100,100,100,0.3)',
                  border: '1px solid rgba(100,255,100,0.5)',
                  borderRadius: '50%',
                  color: deckCard.quantity < 10 ? '#66ff66' : '#666',
                  cursor: deckCard.quantity < 10 ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={() => onRemoveCard(deckCard.cardUrl, deckCard.quantity)}
            style={{
              padding: '4px 8px',
              background: 'rgba(255,0,0,0.2)',
              border: '1px solid rgba(255,0,0,0.4)',
              borderRadius: 4,
              color: '#ff6666',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,0,0,0.2)';
            }}
          >
            Remove
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: 6
        }}>
          <button
            onClick={() => onEditCard(deckCard.cardUrl)}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            ✏️ Edit
          </button>
          
          <button
            onClick={() => onViewCard(deckCard.cardUrl)}
            style={{
              background: 'linear-gradient(135deg, #00ffff 0%, #0088ff 100%)',
              color: '#000',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
            }}
          >
            👁️ View
          </button>
        </div>
      </div>
    </div>
  );
};

// Component to display the deck author's name
const DeckAuthorName: React.FC<{ authorId: AutomergeUrl }> = ({ authorId }) => {
  const [contact] = useDocument<ContactDoc>(authorId, { suspense: false });

  if (!contact) {
    return <span>Loading...</span>;
  }

  return <span>{contact.name || 'Unknown Player'}</span>;
};

export default DeckView;
