import React, { useState } from 'react';
import { AutomergeUrl, useRepo } from '@automerge/react';
import { CardDoc, createCard, CardType, RendererDesc, ImageRendererDesc } from '../docs/card';
import { ArtifactAbility, TriggerAbilityEvent } from '../utils/spellEffects';
import { makeCardViewUrl } from '../hooks/useGameNavigation';
import Card from './Card';
import ImageEditor from './ImageEditor';
import MonacoCodeEditor from './MonacoCodeEditor';

export type NewCardForm = {
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: CardType;
  description: string;
  spellEffect?: string;
  triggeredAbilities: ArtifactAbility[];
  renderer?: RendererDesc | null;
};

type EditingCard = {
  card: CardDoc;
  isBuiltin: boolean;
  cardUrl?: AutomergeUrl;
} | null;

type CardEditorProps = {
  rootDocSelfId: string;
  editingCard: EditingCard;
  onSave: (cardUrl: AutomergeUrl) => void;
  onCancel: () => void;
  onClone: (cardData: NewCardForm) => void;
};

const CardEditor: React.FC<CardEditorProps> = ({
  rootDocSelfId,
  editingCard,
  onSave,
  onCancel,
  onClone
}) => {
  const repo = useRepo();
  const [imageEditorKey, setImageEditorKey] = useState(0);
  const [newCardData, setNewCardData] = useState<NewCardForm>(() => {
    if (!editingCard) {
      return {
        name: '',
        cost: 1,
        type: 'creature',
        description: '',
        triggeredAbilities: [],
        renderer: null
      };
    }

    const card = editingCard.card;
    // Convert triggered abilities from the card to the form format
    let triggeredAbilities: ArtifactAbility[] = [];
    if (card.triggeredAbilities) {
      triggeredAbilities = card.triggeredAbilities.map(ability => ({
        trigger: ability.trigger,
        effectCode: ability.effectCode,
        description: ability.description || ''
      }));
    }

    return {
      name: card.name || '',
      cost: card.cost || 0,
      attack: card.attack !== undefined ? card.attack : undefined,
      health: card.health !== undefined ? card.health : undefined,
      type: (card.type || 'creature') as CardType,
      description: String(card.description || ''),
      spellEffect: card.spellEffect ? String(card.spellEffect) : '',
      triggeredAbilities: triggeredAbilities,
      renderer: card.renderer || null
    };
  });

  const handleCreateCard = () => {
    if (!newCardData.name.trim()) {
      alert('Please fill in the card name');
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
      description: newCardData.description,
      createdBy: rootDocSelfId
    };

    // Only add properties if they have values (Automerge doesn't support undefined)
    if (newCardData.type === 'creature') {
      if (newCardData.attack !== undefined) cardData.attack = newCardData.attack || 0;
    }
    if (newCardData.type === 'creature' || newCardData.type === 'artifact') {
      if (newCardData.health !== undefined) cardData.health = newCardData.health || 0;
    }

    if (newCardData.spellEffect?.trim()) {
      cardData.spellEffect = newCardData.spellEffect.trim();
    }

    if (newCardData.triggeredAbilities.length > 0) {
      cardData.triggeredAbilities = newCardData.triggeredAbilities;
    }

    if (newCardData.renderer) {
      cardData.renderer = newCardData.renderer;
    }

    const cardDefHandle = createCard(repo, cardData);
    onSave(cardDefHandle.url);
  };

  const handleUpdateCard = async () => {
    if (!editingCard || editingCard.isBuiltin) return;
    
    if (!newCardData.name.trim()) {
      alert('Please fill in the card name');
      return;
    }

    console.log('Starting card update for:', editingCard.cardUrl);
    console.log('Update data:', {
      name: newCardData.name.trim(),
      cost: newCardData.cost,
      type: newCardData.type,
      description: newCardData.description,
      attack: newCardData.attack,
      health: newCardData.health,
      spellEffect: newCardData.spellEffect,
      triggeredAbilitiesCount: newCardData.triggeredAbilities.length
    });

    // Update the document using the correct Automerge pattern
    if (editingCard.cardUrl) {
      try {
        const cardHandle = await repo.find<CardDoc>(editingCard.cardUrl);
        console.log('Got card handle, updating document...');
        cardHandle.change((doc: CardDoc) => {
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
            doc.name = newCardData.name.trim();
            doc.cost = newCardData.cost;
            doc.type = newCardData.type;
            doc.description = newCardData.description;
            
            // Handle creature-specific properties
            if (newCardData.type === 'creature') {
              doc.attack = newCardData.attack || 0;
            } else {
              // Remove attack for non-creatures
              delete doc.attack;
            }
            
            // Handle health for creatures and artifacts
            if (newCardData.type === 'creature' || newCardData.type === 'artifact') {
              doc.health = newCardData.health || 0;
            } else {
              // Remove health for spells
              delete doc.health;
            }
            
            // Handle spell effect
            if (newCardData.spellEffect?.trim()) {
              doc.spellEffect = newCardData.spellEffect.trim();
            } else {
              delete doc.spellEffect;
            }
            
            // Handle triggered abilities - ensure we create completely new objects
            if (newCardData.triggeredAbilities.length > 0) {
              // Create a completely new array with new objects to avoid any reference issues
              const cleanAbilities = newCardData.triggeredAbilities.map(ability => {
                // Ensure we're creating plain objects, not Automerge references
                return {
                  trigger: ability.trigger,
                  effectCode: ability.effectCode,
                  description: ability.description || ''
                };
              });
              doc.triggeredAbilities = cleanAbilities;
            } else {
              delete doc.triggeredAbilities;
            }
            
            // Handle renderer
            if (newCardData.renderer) {
              doc.renderer = newCardData.renderer;
            } else {
              delete doc.renderer;
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
        onCancel();
      } catch (error) { 
        console.error('Error updating card:', error);
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
      // Reset attack/health when changing type
      attack: type === 'creature' ? (prev.attack || 1) : undefined,
      health: (type === 'creature' || type === 'artifact') ? (prev.health || 1) : undefined
    }));
  };

  const handleCloneCard = () => {
    if (!editingCard) return;
    
    // Clear the editing state and create a new card based on current form values
    onClone({
      name: `${newCardData.name} (Copy)`,
      cost: newCardData.cost,
      attack: newCardData.attack,
      health: newCardData.health,
      type: newCardData.type,
      description: newCardData.description,
      spellEffect: newCardData.spellEffect,
      triggeredAbilities: newCardData.triggeredAbilities,
      renderer: newCardData.renderer
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
          (editingCard.isBuiltin ? '🔍 View Builtin Card' : '✏️ Edit Card') : 
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
              name: newCardData.name || 'Card Name',
              cost: newCardData.cost,
              attack: newCardData.type === 'creature' ? (newCardData.attack || 1) : undefined,
              health: (newCardData.type === 'creature' || newCardData.type === 'artifact') ? (newCardData.health || 1) : undefined,
              type: newCardData.type,
              description: newCardData.description || 'Card description will appear here...',
              spellEffect: newCardData.spellEffect,
              triggeredAbilities: newCardData.triggeredAbilities,
              renderer: newCardData.renderer,
              createdAt: new Date().toISOString(),
              createdBy: 'preview' as AutomergeUrl,
              isPlayable: false
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

            {/* Creature/Artifact Stats */}
            {(newCardData.type === 'creature' || newCardData.type === 'artifact') && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: newCardData.type === 'creature' ? '1fr 1fr' : '1fr', 
                gap: 16, 
                marginBottom: 16,
                padding: 16,
                background: 'rgba(255,100,100,0.1)',
                border: '1px solid rgba(255,100,100,0.3)',
                borderRadius: 8
              }}>
                {newCardData.type === 'creature' && (
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
                )}
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
                          onChange={(e) => updateTriggeredAbility(index, 'trigger', e.target.value as TriggerAbilityEvent)}
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

            {/* Renderer Section - Only show for non-builtin cards */}
            {!editingCard?.isBuiltin && (
              <div style={{ 
                padding: 16,
                background: 'rgba(255,165,0,0.05)',
                border: '1px solid rgba(255,165,0,0.3)',
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
                    color: '#ffaa00',
                    fontWeight: 600
                  }}>
                    🎨 Card Renderer
                  </label>
                  <select
                    value={newCardData.renderer?.type || 'default'}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'default') {
                        setNewCardData(prev => ({ ...prev, renderer: null }));
                      } else if (value === 'image') {
                        setNewCardData(prev => ({ 
                          ...prev, 
                          renderer: { type: 'image', url: '' } as ImageRendererDesc 
                        }));
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,165,0,0.5)',
                      borderRadius: 6,
                      color: '#ffaa00',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    <option value="default">Default Card Frame</option>
                    <option value="image">Custom Image</option>
                  </select>
                </div>

                {/* Image Editor */}
                {newCardData.renderer?.type === 'image' && (
                  <ImageEditor
                    key={`image-editor-${imageEditorKey}`}
                    onImageChange={(dataUri) => {
                      if (dataUri) {
                        setNewCardData(prev => ({
                          ...prev,
                          renderer: { type: 'image', url: dataUri } as ImageRendererDesc
                        }));
                      } else {
                        setNewCardData(prev => ({
                          ...prev,
                          renderer: { type: 'image', url: '' } as ImageRendererDesc
                        }));
                      }
                    }}
                    initialImage={
                      newCardData.renderer?.type === 'image' && (newCardData.renderer as ImageRendererDesc).url ? 
                      (newCardData.renderer as ImageRendererDesc).url : 
                      null
                    }
                    width={240}
                    height={336}
                    showUndoButton={!!editingCard && !editingCard.isBuiltin}
                    onUndo={() => {
                      if (editingCard?.card.renderer && editingCard.card.renderer.type === 'image') {
                        const imageRenderer = editingCard.card.renderer as ImageRendererDesc;
                        setNewCardData(prev => ({
                          ...prev,
                          renderer: { type: 'image', url: imageRenderer.url } as ImageRendererDesc
                        }));
                      } else {
                        setNewCardData(prev => ({
                          ...prev,
                          renderer: null
                        }));
                      }
                      // Force ImageEditor to re-render with new initial image
                      setImageEditorKey(prev => prev + 1);
                    }}
                  />
                )}
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
                    disabled={!newCardData.name.trim()}
                    style={{
                      background: newCardData.name.trim() ?
                        'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)' :
                        'rgba(100,100,100,0.3)',
                      color: newCardData.name.trim() ? '#000' : '#666',
                      border: 'none',
                      padding: '16px 32px',
                      borderRadius: 8,
                      cursor: newCardData.name.trim() ? 'pointer' : 'not-allowed',
                      fontSize: 16,
                      fontWeight: 700,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(0,255,0,0.3)'
                    }}
                    onMouseEnter={(e) => {
                      if (newCardData.name.trim()) {
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
                        onClick={handleCloneCard}
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
                onClick={onCancel}
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
  );
};

export default CardEditor;
