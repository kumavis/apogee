import React, { useState } from 'react';
import { AutomergeUrl, useDocument, useRepo } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { CardDefinition, createCardDefinition } from '../docs/cardDefinition';
import { useGameNavigation, makeCardViewUrl } from '../hooks/useGameNavigation';
import { CARD_LIBRARY } from '../utils/cardLibrary';
import { GameCard, CardType } from '../docs/game';
import Card from './Card';
import { ArtifactAbility, ArtifactTrigger } from '../utils/spellEffects';
import Editor from '@monaco-editor/react';

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
  triggeredAbilities: ArtifactAbility[]; // Array of ability objects instead of JSON string
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
    description: '',
    triggeredAbilities: []
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

    if (newCardData.triggeredAbilities.length > 0) {
      cardData.triggeredAbilities = newCardData.triggeredAbilities;
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

    console.log('Starting card update for:', editingCard.cardUrl);
    console.log('Update data:', {
      name: newCardData.name.trim(),
      cost: newCardData.cost,
      type: newCardData.type,
      description: newCardData.description.trim(),
      attack: newCardData.attack,
      health: newCardData.health,
      spellEffect: newCardData.spellEffect,
      triggeredAbilitiesCount: newCardData.triggeredAbilities.length
    });

    // Update the document using the correct Automerge pattern
    if (editingCard.cardUrl) {
      try {
        const cardHandle = repo.find(editingCard.cardUrl);
        if (cardHandle) {
          cardHandle.then((handle) => {
            if (handle) {
              console.log('Got card handle, updating document...');
              handle.change((doc: any) => {
                try {
                  console.log('Current document state:', {
                    name: doc.name,
                    cost: doc.cost,
                    type: doc.type,
                    hasAttack: 'attack' in doc,
                    hasHealth: 'health' in doc,
                    hasSpellEffect: 'spellEffect' in doc,
                    hasTriggeredAbilities: 'triggeredAbilities' in doc
                  });
                  
                  // Update basic properties - ensure we're setting primitive values
                  doc.name = String(newCardData.name.trim());
                  doc.cost = Number(newCardData.cost);
                  doc.type = String(newCardData.type);
                  doc.description = String(newCardData.description.trim());
                  
                  // Handle creature-specific properties
                  if (newCardData.type === 'creature') {
                    doc.attack = Number(newCardData.attack || 1);
                    doc.health = Number(newCardData.health || 1);
                  } else {
                    // Remove attack/health for non-creatures
                    delete doc.attack;
                    delete doc.health;
                  }
                  
                  // Handle spell effect
                  if (newCardData.spellEffect?.trim()) {
                    doc.spellEffect = String(newCardData.spellEffect.trim());
                  } else {
                    delete doc.spellEffect;
                  }
                  
                  // Handle triggered abilities - ensure we create completely new objects
                  if (newCardData.triggeredAbilities.length > 0) {
                    // Create a completely new array with new objects to avoid any reference issues
                    const cleanAbilities = newCardData.triggeredAbilities.map(ability => {
                      // Ensure we're creating plain objects, not Automerge references
                      return {
                        trigger: String(ability.trigger),
                        effectCode: String(ability.effectCode),
                        description: String(ability.description || '')
                      };
                    });
                    doc.triggeredAbilities = cleanAbilities;
                  } else {
                    delete doc.triggeredAbilities;
                  }
                  
                  console.log('Document updated successfully');
                } catch (updateError) {
                  console.error('Error during document update:', updateError);
                  console.error('Update error details:', {
                    error: updateError,
                    errorType: typeof updateError,
                    errorMessage: updateError instanceof Error ? updateError.message : 'Unknown error type',
                    errorStack: updateError instanceof Error ? updateError.stack : 'No stack trace'
                  });
                  throw updateError; // Re-throw to be caught by outer catch
                }
              });
              
              console.log('Card update completed successfully');
              // Reset form on successful update
              handleCancelEdit();
            } else {
              throw new Error('Card handle not found');
            }
          }).catch((error) => {
            console.error('Error updating card:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error updating card: ${errorMessage}`);
          });
        } else {
          throw new Error('Card handle not found');
        }
      } catch (error) {
        console.error('Error in handleUpdateCard:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Error updating card: ${errorMessage}`);
      }
    } else {
      console.error('No card URL available for update');
      alert('Error: No card URL available for update');
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

  const handleEditCard = (card: CardDefinition | GameCard, isBuiltin: boolean, cardUrl?: AutomergeUrl) => {
    setEditingCard({ card, isBuiltin, cardUrl });
    
    // Convert triggered abilities from the card to the form format
    // Ensure we create completely new objects to avoid Automerge reference issues
    let triggeredAbilities: ArtifactAbility[] = [];
    if (card.triggeredAbilities) {
      triggeredAbilities = card.triggeredAbilities.map(ability => ({
        trigger: ability.trigger,
        effectCode: ability.effectCode,
        description: ability.description || ''
      }));
    }
    
    setNewCardData({
      name: String(card.name || ''),
      cost: Number(card.cost || 1),
      attack: card.attack !== undefined ? Number(card.attack) : undefined,
      health: card.health !== undefined ? Number(card.health) : undefined,
      type: (card.type || 'creature') as CardType,
      description: String(card.description || ''),
      spellEffect: card.spellEffect ? String(card.spellEffect) : '',
      triggeredAbilities: triggeredAbilities
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
      description: '',
      triggeredAbilities: []
    });
  };

  // Helper functions for triggered abilities
  const addTriggeredAbility = () => {
    setNewCardData(prev => ({
      ...prev,
      triggeredAbilities: [
        ...prev.triggeredAbilities,
        {
          trigger: 'start_turn',
          effectCode: '',
          description: ''
        }
      ]
    }));
  };

  const updateTriggeredAbility = (index: number, field: keyof ArtifactAbility, value: string) => {
    setNewCardData(prev => ({
      ...prev,
      triggeredAbilities: prev.triggeredAbilities.map((ability, i) => 
        i === index ? { ...ability, [field]: value } : ability
      )
    }));
  };

  const removeTriggeredAbility = (index: number) => {
    setNewCardData(prev => ({
      ...prev,
      triggeredAbilities: prev.triggeredAbilities.filter((_, i) => i !== index)
    }));
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
                                              return newCardData.triggeredAbilities;
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

                {/* Triggered Abilities Section */}
                {(newCardData.type === 'creature' || newCardData.type === 'artifact') && (
                  <div style={{ 
                    padding: 16,
                    background: 'rgba(128,0,128,0.05)',
                    border: '1px solid rgba(128,0,128,0.3)',
                    borderRadius: 8,
                    marginBottom: 16
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: 16
                    }}>
                      <label style={{ 
                        fontSize: 14, 
                        opacity: 0.9,
                        color: '#bb88ff',
                        fontWeight: 600
                      }}>
                        🔮 Triggered Abilities
                      </label>
                      <button
                        type="button"
                        onClick={addTriggeredAbility}
                        disabled={editingCard?.isBuiltin}
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(128,0,128,0.3)',
                          border: '1px solid rgba(128,0,128,0.5)',
                          borderRadius: 6,
                          color: '#bb88ff',
                          cursor: editingCard?.isBuiltin ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                        onMouseEnter={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.currentTarget.style.background = 'rgba(128,0,128,0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!editingCard?.isBuiltin) {
                            e.currentTarget.style.background = 'rgba(128,0,128,0.3)';
                          }
                        }}
                      >
                        ➕ Add Ability
                      </button>
                    </div>

                    {newCardData.triggeredAbilities.length === 0 ? (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#bb88ff',
                        opacity: 0.7,
                        fontSize: 14,
                        fontStyle: 'italic'
                      }}>
                        No triggered abilities defined. Click "Add Ability" to create one.
                      </div>
                    ) : (
                      newCardData.triggeredAbilities.map((ability, index) => (
                        <div key={index} style={{
                          padding: 16,
                          background: 'rgba(128,0,128,0.1)',
                          border: '1px solid rgba(128,0,128,0.2)',
                          borderRadius: 8,
                          marginBottom: 12,
                          position: 'relative'
                        }}>
                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => removeTriggeredAbility(index)}
                            disabled={editingCard?.isBuiltin}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 24,
                              height: 24,
                              background: 'rgba(255,0,0,0.2)',
                              border: '1px solid rgba(255,0,0,0.4)',
                              borderRadius: '50%',
                              color: '#ff6666',
                              cursor: editingCard?.isBuiltin ? 'not-allowed' : 'pointer',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (!editingCard?.isBuiltin) {
                                e.currentTarget.style.background = 'rgba(255,0,0,0.3)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!editingCard?.isBuiltin) {
                                e.currentTarget.style.background = 'rgba(255,0,0,0.2)';
                              }
                            }}
                          >
                            ✕
                          </button>

                          {/* Trigger selection */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{
                              display: 'block',
                              marginBottom: 4,
                              fontSize: 12,
                              color: '#bb88ff',
                              fontWeight: 600
                            }}>
                              Trigger:
                            </label>
                            <select
                              value={ability.trigger}
                              onChange={(e) => updateTriggeredAbility(index, 'trigger', e.target.value as ArtifactTrigger)}
                              disabled={editingCard?.isBuiltin}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid rgba(128,0,128,0.3)',
                                background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.6)' : 'rgba(0,0,0,0.6)',
                                color: editingCard?.isBuiltin ? '#999' : '#fff',
                                fontSize: 12,
                                outline: 'none'
                              }}
                            >
                              <option value="start_turn">Start of Turn</option>
                              <option value="end_turn">End of Turn</option>
                              <option value="play_card">When Card is Played</option>
                              <option value="take_damage">When Takes Damage</option>
                              <option value="deal_damage">When Deals Damage</option>
                            </select>
                          </div>

                          {/* Description */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{
                              display: 'block',
                              marginBottom: 4,
                              fontSize: 12,
                              color: '#bb88ff',
                              fontWeight: 600
                            }}>
                              Description:
                            </label>
                            <input
                              type="text"
                              value={ability.description || ''}
                              onChange={(e) => updateTriggeredAbility(index, 'description', e.target.value)}
                              disabled={editingCard?.isBuiltin}
                              placeholder="e.g., Heal all your creatures for 1"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid rgba(128,0,128,0.3)',
                                background: editingCard?.isBuiltin ? 'rgba(100,100,100,0.6)' : 'rgba(0,0,0,0.6)',
                                color: editingCard?.isBuiltin ? '#999' : '#fff',
                                fontSize: 12,
                                outline: 'none'
                              }}
                            />
                          </div>

                                                    {/* Effect Code */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: 4,
                              fontSize: 12,
                              color: '#bb88ff',
                              fontWeight: 600
                            }}>
                              Effect Code:
                            </label>
                            <div style={{
                              fontSize: 11,
                              color: '#bb88ff',
                              opacity: 0.7,
                              marginBottom: 8,
                              fontStyle: 'italic'
                            }}>
                              Available API methods: api.healCreature(playerId, instanceId, amount), api.dealDamageToPlayer(playerId, amount), api.log(message)
                            </div>
                            <MonacoCodeEditor
                              value={ability.effectCode}
                              onChange={(value) => updateTriggeredAbility(index, 'effectCode', value)}
                              disabled={editingCard?.isBuiltin}
                              defaultHeight="250px"
                              resizable={true}
                              collapsible={true}
                              title={`Ability ${index + 1} Effect Code`}
                            />
                          </div>
                        </div>
                      ))
                    )}
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
                    <div style={{
                      fontSize: 12,
                      color: '#ffff66',
                      opacity: 0.8,
                      marginBottom: 12,
                      fontStyle: 'italic'
                    }}>
                      Leave empty for basic spells. Example: api.dealDamageToPlayer(targetPlayerId, 3);
                    </div>
                                        <MonacoCodeEditor
                       value={newCardData.spellEffect || ''}
                       defaultHeight="400px"
                       onChange={(value) => {
                         setNewCardData(prev => ({ ...prev, spellEffect: value }));
                       }}
                       disabled={editingCard?.isBuiltin}
                       resizable={true}
                       collapsible={true}
                       title="Spell Effect Code"
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
                        <>
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
                          <button
                            onClick={() => {
                              if (editingCard?.cardUrl) {
                                const cardUrl = makeCardViewUrl(editingCard.cardUrl);
                                navigator.clipboard.writeText(cardUrl).then(() => {
                                  console.log('Card URL copied to clipboard:', cardUrl);
                                }).catch(err => {
                                  console.error('Failed to copy card URL:', err);
                                });
                              }
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #00ffff 0%, #0088ff 100%)',
                              color: '#000',
                              border: 'none',
                              padding: '16px 32px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              fontSize: 16,
                              fontWeight: 700,
                              transition: 'all 0.2s ease',
                              boxShadow: '0 4px 12px rgba(0,255,255,0.3)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,255,255,0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,255,0.3)';
                            }}
                          >
                            🔗 Copy URL
                          </button>
                        </>
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 140px))',
              gap: 16,
              justifyContent: 'center'
            }}>
              {rootDoc.cardLibrary.map((cardUrl) => (
                <LoadingCardDisplay 
                  key={cardUrl} 
                  cardUrl={cardUrl} 
                  onCardSelect={handleEditCard}
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 140px))',
            gap: 16,
            justifyContent: 'center'
          }}>
            {hardcodedCards.map((card) => (
              <div 
                key={card.id} 
                style={{ 
                  opacity: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onClick={() => handleEditCard(card, true)}
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

// Monaco Code Editor Component
const MonacoCodeEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  height?: string;
  language?: string;
  resizable?: boolean;
  defaultHeight?: string;
  collapsible?: boolean;
  title?: string;
}> = ({ value, onChange, placeholder, disabled = false, height = '200px', language = 'javascript', resizable = true, defaultHeight = '200px', collapsible = false, title = 'Code Editor' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentHeight, setCurrentHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  const handleEditorDidMount = () => {
    setIsLoading(false);
  };

  const handleEditorWillMount = (monaco: any) => {
    // Register custom theme
    monaco.editor.defineTheme('apogee-dark', {
      base: 'vs-dark' as const,
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '#ff6b6b', fontStyle: 'bold' },
        { token: 'string', foreground: '#51cf66' },
        { token: 'number', foreground: '#74c0fc' },
        { token: 'comment', foreground: '#868e96', fontStyle: 'italic' },
        { token: 'function', foreground: '#fcc419' },
        { token: 'property', foreground: '#ae8fff' },
        { token: 'operator', foreground: '#ffd43b' },
        { token: 'type', foreground: '#20c997' }
      ],
      colors: {
        'editor.background': '#1a1a1a',
        'editor.foreground': '#ffffff',
        'editor.lineHighlightBackground': '#2a2a2a',
        'editor.selectionBackground': '#3a3a3a',
        'editor.inactiveSelectionBackground': '#2a2a2a',
        'editorCursor.foreground': '#bb88ff',
        'editorWhitespace.foreground': '#404040',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#606060'
      }
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!resizable || disabled) return;
    
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = parseInt(currentHeight);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(100, startHeight + deltaY); // Minimum height of 100px
      setCurrentHeight(`${newHeight}px`);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (isCollapsed) {
    return (
      <div style={{
        border: '1px solid rgba(128,0,128,0.3)',
        borderRadius: 6,
        background: 'rgba(128,0,128,0.1)',
        padding: '8px 12px',
        cursor: 'pointer'
      }} onClick={toggleCollapse}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#bb88ff',
          fontSize: 12
        }}>
          <span>📝 {title} (Click to expand)</span>
          <span>▶️</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid rgba(128,0,128,0.3)',
      borderRadius: 6,
      overflow: 'hidden',
      opacity: disabled ? 0.6 : 1,
      position: 'relative'
    }}>
      {/* Header with collapse button */}
      {collapsible && (
        <div style={{
          background: 'rgba(128,0,128,0.2)',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(128,0,128,0.3)'
        }}>
          <span style={{
            color: '#bb88ff',
            fontSize: 11,
            fontWeight: 600
          }}>
            📝 {title}
          </span>
          <button
            onClick={toggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              color: '#bb88ff',
              cursor: 'pointer',
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 3
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(128,0,128,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            🔽
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{
          position: 'absolute',
          top: collapsible ? 32 : 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#bb88ff',
          fontSize: 12,
          zIndex: 10
        }}>
          Loading code editor...
        </div>
      )}
      <Editor
        height={currentHeight}
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        beforeMount={handleEditorWillMount}
        options={{
          readOnly: disabled,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          lineNumbers: 'on',
          roundedSelection: false,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible'
          },
          automaticLayout: true,
          wordWrap: 'on',
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          parameterHints: {
            enabled: true
          },
          hover: {
            enabled: true
          },
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          renderLineHighlight: 'all',
          selectOnLineNumbers: true,
          contextmenu: true,
          mouseWheelZoom: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on'
        }}
        theme="apogee-dark"
      />
      
      {/* Resize handle */}
      {resizable && !disabled && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'rgba(128,0,128,0.3)',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(128,0,128,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(128,0,128,0.3)';
          }}
        >
          <div style={{
            width: '30px',
            height: '2px',
            background: 'rgba(128,0,128,0.6)',
            borderRadius: '1px'
          }} />
        </div>
      )}
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
        transition: 'all 0.2s ease',
        position: 'relative'
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
