import React, { useState } from 'react';
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { CardDefinition, createCardDefinition } from '../docs/cardDefinition';
import { useGameNavigation } from '../hooks/useGameNavigation';
import { CARD_LIBRARY } from '../utils/cardLibrary';
import { GameCard, CardType } from '../docs/game';
import Card from './Card';

type CardLibraryProps = {
  rootDoc: RootDocument;
  addCardToLibrary: (cardUrl: AutomergeUrl) => void;
};

type NewCardForm = {
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: CardType;
  description: string;
  spellEffect?: string;
  triggeredAbilities?: string; // JSON string of abilities
};

const CardLibrary: React.FC<CardLibraryProps> = ({ rootDoc, addCardToLibrary }) => {
  const { navigateToHome } = useGameNavigation();
  const repo = useRepo();
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<{ 
    card: CardDefinition | GameCard; 
    isBuiltin: boolean; 
    cardUrl?: AutomergeUrl; // URL for custom cards
  } | null>(null);
  const [newCardData, setNewCardData] = useState<NewCardForm>({
    name: '',
    cost: 1,
    type: 'creature',
    description: ''
  });

  // Get hardcoded cards as read-only GameCard objects
  const hardcodedCards = Object.values(CARD_LIBRARY);

  const handleCreateCard = () => {
    if (!newCardData.name.trim() || !newCardData.description.trim()) {
      alert('Please fill in at least the name and description');
      return;
    }

    // Generate a unique ID for the card
    const cardId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Parse triggered abilities if provided
    let triggeredAbilities = undefined;
    if (newCardData.triggeredAbilities?.trim()) {
      try {
        triggeredAbilities = JSON.parse(newCardData.triggeredAbilities.trim());
      } catch (e) {
        alert('Invalid JSON format for triggered abilities. Please check your syntax.');
        return;
      }
    }

    // Create the card definition document
    const cardData: any = {
      id: cardId,
      name: newCardData.name.trim(),
      cost: newCardData.cost,
      type: newCardData.type,
      description: newCardData.description.trim(),
      createdBy: rootDoc.selfId
    };

    // Only add properties if they have values (Automerge doesn't support undefined)
    if (newCardData.type === 'creature') {
      if (newCardData.attack !== undefined) cardData.attack = newCardData.attack || 1;
      if (newCardData.health !== undefined) cardData.health = newCardData.health || 1;
    }

    if (newCardData.spellEffect?.trim()) {
      cardData.spellEffect = newCardData.spellEffect.trim();
    }

    if (triggeredAbilities) {
      cardData.triggeredAbilities = triggeredAbilities;
    }

    const cardDefHandle = createCardDefinition(repo, cardData);

    // Add to root document's card library
    addCardToLibrary(cardDefHandle.url);

    // Reset form
    handleCancelEdit();
  };

  const handleUpdateCard = () => {
    if (!editingCard || editingCard.isBuiltin) return;
    
    if (!newCardData.name.trim() || !newCardData.description.trim()) {
      alert('Please fill in at least the name and description');
      return;
    }

    // Update existing custom card
    const cardDef = editingCard.card as CardDefinition;
    
    // Parse triggered abilities if provided
    let triggeredAbilities = undefined;
    if (newCardData.triggeredAbilities?.trim()) {
      try {
        triggeredAbilities = JSON.parse(newCardData.triggeredAbilities.trim());
      } catch (e) {
        alert('Invalid JSON format for triggered abilities. Please check your syntax.');
        return;
      }
    }

    // Update the card definition document using the repo
    try {
      if (!editingCard.cardUrl) {
        alert('Unable to find card URL for updating. Please try again.');
        return;
      }
      
      // Get the document handle and update it
      const cardHandle = repo.find(editingCard.cardUrl);
      if (cardHandle) {
        // Wait for the handle to resolve and then update
        cardHandle.then((handle) => {
          if (handle) {
            handle.change((doc: any) => {
              doc.name = newCardData.name.trim();
              doc.cost = newCardData.cost;
              doc.type = newCardData.type;
              doc.description = newCardData.description.trim();
              
              // Update creature stats
              if (newCardData.type === 'creature') {
                doc.attack = newCardData.attack || 1;
                doc.health = newCardData.health || 1;
              } else {
                // Remove attack/health for non-creatures
                delete doc.attack;
                delete doc.health;
              }
              
              // Update spell effect
              if (newCardData.spellEffect?.trim()) {
                doc.spellEffect = newCardData.spellEffect.trim();
              } else {
                delete doc.spellEffect;
              }
              
              // Update triggered abilities
              if (triggeredAbilities) {
                doc.triggeredAbilities = triggeredAbilities;
              } else {
                delete doc.triggeredAbilities;
              }
            });
            
            // Reset form and close
            handleCancelEdit();
          } else {
            alert('Unable to find card document for updating. Please try again.');
          }
        }).catch((error) => {
          console.error('Error updating card:', error);
          alert('Error updating card. Please try again.');
        });
      } else {
        alert('Unable to find card document for updating. Please try again.');
      }
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Error updating card. Please try again.');
      return;
    }
  };

  const handleTypeChange = (type: CardType) => {
    setNewCardData(prev => ({
      ...prev,
      type,
      // Reset attack/health when changing from creature
      attack: type === 'creature' ? (prev.attack || 1) : undefined,
      health: type === 'creature' ? (prev.health || 1) : undefined
    }));
  };

  const handleCardSelect = (card: CardDefinition | GameCard, isBuiltin: boolean, cardUrl?: AutomergeUrl) => {
    setEditingCard({ card, isBuiltin, cardUrl });
    setNewCardData({
      name: card.name,
      cost: card.cost,
      attack: card.attack,
      health: card.health,
      type: card.type,
      description: card.description,
      spellEffect: card.spellEffect,
      triggeredAbilities: card.triggeredAbilities ? JSON.stringify(card.triggeredAbilities, null, 2) : undefined
    });
    setShowNewCardForm(true);
  };

  const handleCloneCard = () => {
    if (!editingCard) return;
    
    // Clear the editing state and create a new card based on current form values
    setEditingCard(null);
    setNewCardData({
      name: `${newCardData.name} (Copy)`,
      cost: newCardData.cost,
      attack: newCardData.attack,
      health: newCardData.health,
      type: newCardData.type,
      description: newCardData.description,
      spellEffect: newCardData.spellEffect,
      triggeredAbilities: newCardData.triggeredAbilities
    });
  };

  const handleCloneCustomCard = () => {
    if (!editingCard || editingCard.isBuiltin) return;
    
    // Create a clone based on current form values
    setNewCardData({
      name: `${newCardData.name} (Copy)`,
      cost: newCardData.cost,
      attack: newCardData.attack,
      health: newCardData.health,
      type: newCardData.type,
      description: newCardData.description,
      spellEffect: newCardData.spellEffect,
      triggeredAbilities: newCardData.triggeredAbilities
    });
    setEditingCard(null); // Clear editing state to create new card
  };

  const handleCancelEdit = () => {
    setShowNewCardForm(false);
    setEditingCard(null);
    setNewCardData({
      name: '',
      cost: 1,
      type: 'creature',
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
      // Custom scrollbar styling
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(0,255,255,0.6) rgba(0,0,0,0.3)'
    }}>
      <style>
        {`
          /* Webkit scrollbar styling */
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
          📚 Card Library
        </h1>
        <button
          onClick={() => setShowNewCardForm(!showNewCardForm)}
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
          + New Card
        </button>
      </div>

      {/* New Card Form */}
      {showNewCardForm && (
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
            {editingCard ? 
              (editingCard.isBuiltin ? '🔍 View Builtin Card' : '✏️ Edit Custom Card') : 
              '🎨 Create New Card'
            }
          </h3>
          
          {/* Card Designer Layout */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '400px 1fr', 
            gap: 32,
            alignItems: 'start'
          }}>
            {/* Live Card Preview */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ 
                transform: 'scale(3.2)', 
                top: 184,
                position: 'relative'
              }}>
                <Card card={{
                  id: 'preview',
                  name: newCardData.name || 'Card Name',
                  cost: newCardData.cost,
                  attack: newCardData.type === 'creature' ? (newCardData.attack || 1) : undefined,
                  health: newCardData.type === 'creature' ? (newCardData.health || 1) : undefined,
                  type: newCardData.type,
                  description: newCardData.description || 'Card description will appear here...',
                  spellEffect: newCardData.spellEffect,
                  triggeredAbilities: newCardData.triggeredAbilities ? 
                    (() => {
                      try {
                        return JSON.parse(newCardData.triggeredAbilities);
                      } catch {
                        return undefined;
                      }
                    })() : undefined
                }} />
              </div>
            </div>

            {/* Form Fields */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,255,255,0.05) 0%, rgba(0,255,0,0.05) 100%)',
              border: '1px solid rgba(0,255,255,0.2)',
              borderRadius: 12,
              padding: 24
            }}>
              <h4 style={{ 
                margin: '0 0 20px 0', 
                color: '#00ffff',
                fontSize: 18,
                borderBottom: '1px solid rgba(0,255,255,0.3)',
                paddingBottom: 8
              }}>
                Card Properties
              </h4>

              {/* Basic Info */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 4fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 6, 
                      fontSize: 14, 
                      opacity: 0.9,
                      color: '#00ffff',
                      fontWeight: 600
                    }}>
                      Energy Cost
                    </label>
                                          <input
                        type="number"
                        min="0"
                        max="20"
                        value={newCardData.cost}
                        onChange={(e) => setNewCardData(prev => ({ ...prev, cost: parseInt(e.target.value) || 0 }))}
                        disabled={editingCard?.isBuiltin}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '2px solid rgba(0,255,255,0.3)',
                          background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.4)',
                          color: editingCard?.isBuiltin ? '#999' : '#fff',
                          fontSize: 16,
                          fontWeight: 600,
                          textAlign: 'center',
                          outline: 'none',
                          cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                        }}
                        onFocus={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.target.style.borderColor = 'rgba(0,255,255,0.6)';
                          }
                        }}
                        onBlur={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.target.style.borderColor = 'rgba(0,255,255,0.3)';
                          }
                        }}
                      />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 6, 
                      fontSize: 14, 
                      opacity: 0.9,
                      color: '#00ffff',
                      fontWeight: 600
                    }}>
                      Card Name
                    </label>
                    <input
                      type="text"
                      value={newCardData.name}
                      onChange={(e) => {
                        const target = e.target;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const value = target.value;
                        
                        setNewCardData(prev => ({ ...prev, name: value }));
                        
                        // Preserve cursor position after state update
                        setTimeout(() => {
                          target.setSelectionRange(start, end);
                        }, 0);
                      }}
                      disabled={editingCard?.isBuiltin}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '2px solid rgba(0,255,255,0.3)',
                        background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.4)',
                        color: editingCard?.isBuiltin ? '#999' : '#fff',
                        fontSize: 16,
                        fontWeight: 600,
                        transition: 'border-color 0.2s ease',
                        outline: 'none',
                        cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                      }}
                      placeholder="Enter card name..."
                      onFocus={(e) => {
                        if (!editingCard?.isBuiltin) {
                          e.target.style.borderColor = 'rgba(0,255,255,0.6)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!editingCard?.isBuiltin) {
                          e.target.style.borderColor = 'rgba(0,255,255,0.3)';
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Card Type Selection */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 8, 
                    fontSize: 14, 
                    opacity: 0.9,
                    color: '#00ffff',
                    fontWeight: 600
                  }}>
                    Card Type
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['creature', 'artifact', 'spell'] as CardType[]).map((type) => (
                                              <button
                          key={type}
                          onClick={() => handleTypeChange(type)}
                          disabled={editingCard?.isBuiltin}
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: 8,
                            border: newCardData.type === type ? 
                              '2px solid rgba(0,255,255,0.8)' : 
                              '2px solid rgba(255,255,255,0.2)',
                            background: newCardData.type === type ? 
                              'rgba(0,255,255,0.2)' : 
                              'rgba(0,0,0,0.3)',
                            color: newCardData.type === type ? '#00ffff' : '#fff',
                            cursor: editingCard?.isBuiltin ? 'not-allowed' : 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            textTransform: 'capitalize' as const,
                            transition: 'all 0.2s ease',
                            opacity: editingCard?.isBuiltin ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (newCardData.type !== type && !editingCard?.isBuiltin) {
                              e.currentTarget.style.borderColor = 'rgba(0,255,255,0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (newCardData.type !== type) {
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                            }
                          }}
                        >
                        {type === 'creature' ? '🐲' : type === 'spell' ? '⚡' : '🔧'} {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: 6, 
                    fontSize: 14, 
                    opacity: 0.9,
                    color: '#00ffff',
                    fontWeight: 600
                  }}>
                    Description
                  </label>
                  <textarea
                    value={newCardData.description}
                    onChange={(e) => {
                      const target = e.target;
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const value = target.value;
                      
                      setNewCardData(prev => ({ ...prev, description: value }));
                      
                      // Preserve cursor position after state update
                      setTimeout(() => {
                        target.setSelectionRange(start, end);
                      }, 0);
                    }}
                    disabled={editingCard?.isBuiltin}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '2px solid rgba(0,255,255,0.3)',
                      background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.4)',
                      color: editingCard?.isBuiltin ? '#999' : '#fff',
                      fontSize: 14,
                      minHeight: 80,
                      resize: 'vertical' as const,
                      outline: 'none',
                      lineHeight: 1.4,
                      cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                    }}
                    placeholder="Describe what this card does..."
                    onFocus={(e) => {
                      if (!editingCard?.isBuiltin) {
                        e.target.style.borderColor = 'rgba(0,255,255,0.6)';
                      }
                    }}
                    onBlur={(e) => {
                      if (!editingCard?.isBuiltin) {
                        e.target.style.borderColor = 'rgba(0,255,255,0.3)';
                      }
                    }}
                  />
                </div>

                {/* Creature Stats */}
                {newCardData.type === 'creature' && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: 16, 
                    marginBottom: 16,
                    padding: 16,
                    background: 'rgba(255,100,100,0.1)',
                    border: '1px solid rgba(255,100,100,0.3)',
                    borderRadius: 8
                  }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: 6, 
                        fontSize: 14, 
                        opacity: 0.9,
                        color: '#ff6666',
                        fontWeight: 600
                      }}>
                        ⚔️ Attack
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={newCardData.attack || 1}
                        onChange={(e) => setNewCardData(prev => ({ ...prev, attack: parseInt(e.target.value) || 1 }))}
                        disabled={editingCard?.isBuiltin}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '2px solid rgba(255,100,100,0.3)',
                          background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.4)',
                          color: editingCard?.isBuiltin ? '#999' : '#fff',
                          fontSize: 16,
                          fontWeight: 600,
                          textAlign: 'center',
                          outline: 'none',
                          cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                        }}
                        onFocus={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.target.style.borderColor = 'rgba(255,100,100,0.6)';
                          }
                        }}
                        onBlur={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.target.style.borderColor = 'rgba(255,100,100,0.3)';
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: 6, 
                        fontSize: 14, 
                        opacity: 0.9,
                        color: '#66ff66',
                        fontWeight: 600
                      }}>
                        💚 Health
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={newCardData.health || 1}
                        onChange={(e) => setNewCardData(prev => ({ ...prev, health: parseInt(e.target.value) || 1 }))}
                        disabled={editingCard?.isBuiltin}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '2px solid rgba(100,255,100,0.3)',
                          background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.4)',
                          color: editingCard?.isBuiltin ? '#999' : '#fff',
                          fontSize: 16,
                          fontWeight: 600,
                          textAlign: 'center',
                          outline: 'none',
                          cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                        }}
                        onFocus={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.target.style.borderColor = 'rgba(100,255,100,0.6)';
                          }
                        }}
                        onBlur={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.target.style.borderColor = 'rgba(100,255,100,0.3)';
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Triggered Abilities for Creatures and Artifacts */}
                {(newCardData.type === 'creature' || newCardData.type === 'artifact') && (
                  <div style={{ 
                    padding: 16,
                    background: 'rgba(128,0,128,0.05)',
                    border: '1px solid rgba(128,0,128,0.3)',
                    borderRadius: 8,
                    marginBottom: 16
                  }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 6, 
                      fontSize: 14, 
                      opacity: 0.9,
                      color: '#bb88ff',
                      fontWeight: 600
                    }}>
                      🔮 Triggered Abilities (Advanced - JSON Array)
                    </label>
                    <textarea
                      value={newCardData.triggeredAbilities || ''}
                      onChange={(e) => {
                        const target = e.target;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const value = target.value;
                        
                        setNewCardData(prev => ({ ...prev, triggeredAbilities: value }));
                        
                        // Preserve cursor position after state update
                        setTimeout(() => {
                          target.setSelectionRange(start, end);
                        }, 0);
                      }}
                      disabled={editingCard?.isBuiltin}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '2px solid rgba(128,0,128,0.3)',
                        background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.6)' : 'rgba(0,0,0,0.6)',
                        color: editingCard?.isBuiltin ? '#999' : '#fff',
                        fontSize: 12,
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        minHeight: 120,
                        resize: 'vertical' as const,
                        outline: 'none',
                        lineHeight: 1.4,
                        cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                      }}
                      placeholder={`// Leave empty for no abilities
// Example format:
[
  {
    "trigger": "onPlay",
    "effect": "api.drawCards(1)",
    "description": "Draw a card when played"
  }
]`}
                      onFocus={(e) => {
                        if (!editingCard?.isBuiltin) {
                          e.target.style.borderColor = 'rgba(128,0,128,0.6)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!editingCard?.isBuiltin) {
                          e.target.style.borderColor = 'rgba(128,0,128,0.3)';
                        }
                      }}
                    />
                  </div>
                )}

                {/* Advanced Spell Effects */}
                {newCardData.type === 'spell' && (
                  <div style={{ 
                    padding: 16,
                    background: 'rgba(255,255,0,0.05)',
                    border: '1px solid rgba(255,255,0,0.3)',
                    borderRadius: 8,
                    marginBottom: 16
                  }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: 6, 
                      fontSize: 14, 
                      opacity: 0.9,
                      color: '#ffff66',
                      fontWeight: 600
                    }}>
                      ⚡ Spell Effect Code (Advanced)
                    </label>
                    <textarea
                      value={newCardData.spellEffect || ''}
                      onChange={(e) => {
                        const target = e.target;
                        const start = target.selectionStart;
                        const end = target.selectionEnd;
                        const value = target.value;
                        
                        setNewCardData(prev => ({ ...prev, spellEffect: value }));
                        
                        // Preserve cursor position after state update
                        setTimeout(() => {
                          target.setSelectionRange(start, end);
                        }, 0);
                      }}
                      disabled={editingCard?.isBuiltin}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '2px solid rgba(255,255,0,0.3)',
                        background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.6)' : 'rgba(0,0,0,0.6)',
                        color: editingCard?.isBuiltin ? '#999' : '#fff',
                        fontSize: 12,
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        minHeight: 100,
                        resize: 'vertical' as const,
                        outline: 'none',
                        lineHeight: 1.4,
                        cursor: editingCard?.isBuiltin ? 'not-allowed' : 'text'
                      }}
                      placeholder="// Leave empty for basic spells&#10;// Example:&#10;// api.dealDamageToPlayer(targetPlayerId,3);"
                      onFocus={(e) => {
                        if (!editingCard?.isBuiltin) {
                          e.target.style.borderColor = 'rgba(255,255,0,0.6)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!editingCard?.isBuiltin) {
                          e.target.style.borderColor = 'rgba(255,255,0,0.3)';
                        }
                      }}
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ 
                  display: 'flex', 
                  gap: 16, 
                  justifyContent: 'center',
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px solid rgba(0,255,255,0.3)'
                }}>
                  {editingCard?.isBuiltin ? (
                    /* Builtin Card Actions */
                    <button
                      onClick={handleCloneCard}
                      style={{
                        background: 'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)',
                        color: '#000',
                        border: 'none',
                        padding: '16px 32px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: 700,
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(255,170,0,0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,170,0,0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,170,0,0.3)';
                      }}
                    >
                      📋 Clone Card
                    </button>
                  ) : (
                    /* Create/Edit Card Actions */
                    <>
                      <button
                        onClick={editingCard ? handleUpdateCard : handleCreateCard}
                        disabled={!newCardData.name.trim() || !newCardData.description.trim()}
                        style={{
                          background: newCardData.name.trim() && newCardData.description.trim() ?
                            'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)' :
                            'rgba(100,100,100,0.3)',
                          color: newCardData.name.trim() && newCardData.description.trim() ? '#000' : '#666',
                          border: 'none',
                          padding: '16px 32px',
                          borderRadius: 8,
                          cursor: newCardData.name.trim() && newCardData.description.trim() ? 'pointer' : 'not-allowed',
                          fontSize: 16,
                          fontWeight: 700,
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 12px rgba(0,255,0,0.3)'
                        }}
                        onMouseEnter={(e) => {
                          if (newCardData.name.trim() && newCardData.description.trim()) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,255,0,0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,0,0.3)';
                        }}
                      >
                        {editingCard ? '💾 Save Changes' : '🎨 Create Card'}
                      </button>
                      {editingCard && (
                        <button
                          onClick={handleCloneCustomCard}
                          style={{
                            background: 'linear-gradient(135deg, #00aaff 0%, #0088cc 100%)',
                            color: '#fff',
                            border: 'none',
                            padding: '16px 32px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontSize: 16,
                            fontWeight: 700,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(0,170,255,0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,170,255,0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,170,255,0.3)';
                          }}
                        >
                          📋 Clone Card
                        </button>
                      )}
                    </>
                  )}
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
            </div>
          </div>
        </div>
      )}

      {/* Card Sections */}
      <div>
        {/* Custom Cards */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ 
            fontSize: 20, 
            margin: '0 0 16px 0', 
            color: '#00ffff',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            🎨 Custom Cards ({rootDoc.cardLibrary.length})
          </h2>
          {rootDoc.cardLibrary.length === 0 ? (
            <div style={{
              padding: 20,
              textAlign: 'center',
              opacity: 0.6,
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: 8
            }}>
              No custom cards yet. Create your first card using the form above!
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16
            }}>
              {rootDoc.cardLibrary.map((cardUrl) => (
                <LoadingCardDisplay 
                  key={cardUrl} 
                  cardUrl={cardUrl} 
                  onCardSelect={handleCardSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hardcoded Cards */}
        <div>
          <h2 style={{ 
            fontSize: 20, 
            margin: '0 0 16px 0', 
            color: '#ffaa00',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            🏛️ Base Game Cards ({hardcodedCards.length}) - Read Only
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16
          }}>
            {hardcodedCards.map((card) => (
              <div 
                key={card.id} 
                style={{ 
                  opacity: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => handleCardSelect(card, true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Card card={card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component to display a custom card from URL
const LoadingCardDisplay: React.FC<{ 
  cardUrl: AutomergeUrl; 
  onCardSelect: (card: CardDefinition | GameCard, isBuiltin: boolean, cardUrl?: AutomergeUrl) => void;
}> = ({ cardUrl, onCardSelect }) => {
  const [cardDef] = useDocument<CardDefinition>(cardUrl, { suspense: false });

  if (!cardDef) {
    return (
      <div style={{
        padding: 16,
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
    triggeredAbilities: cardDef.triggeredAbilities
  };

  return (
    <div 
      style={{ 
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
                      onClick={() => onCardSelect(cardDef, false, cardUrl)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <Card card={gameCard} />
    </div>
  );
};

export default CardLibrary;
