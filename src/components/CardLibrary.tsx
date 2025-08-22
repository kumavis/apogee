import React, { useState } from 'react';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { CardDoc } from '../docs/card';
import { useGameNavigation } from '../hooks/useGameNavigation';
import { CARD_LIBRARY } from '../utils/defaultCardLibrary';
import Card from './Card';
import CardEditor, { NewCardForm } from './CardEditor';

type CardLibraryProps = {
  rootDoc: RootDocument;
  addCardToLibrary: (cardUrl: AutomergeUrl) => void;
  removeCardFromLibrary: (cardUrl: AutomergeUrl) => void;
};

const CardLibrary: React.FC<CardLibraryProps> = ({ rootDoc, addCardToLibrary, removeCardFromLibrary }) => {
  const { navigateToHome } = useGameNavigation();
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<{ 
    card: CardDoc; 
    isBuiltin: boolean; 
    cardUrl?: AutomergeUrl; // URL for custom cards
  } | null>(null);

  // Get hardcoded cards with their IDs for React keys
  const hardcodedCardEntries = Object.entries(CARD_LIBRARY);

  const handleCardSave = (cardUrl: AutomergeUrl) => {
    addCardToLibrary(cardUrl);
    handleCancelEdit();
  };

  const handleEditCard = (card: CardDoc | Omit<CardDoc, 'createdAt' | 'createdBy'>, isBuiltin: boolean, cardUrl?: AutomergeUrl) => {
    // Convert template to full CardDoc if needed
    const fullCard: CardDoc = 'createdAt' in card ? card : {
      ...card,
      createdAt: new Date().toISOString(),
      createdBy: rootDoc.selfId
    };
    setEditingCard({ card: fullCard, isBuiltin, cardUrl });
    setShowNewCardForm(true);
  };

  const handleCloneCard = (_cardData: NewCardForm) => {
    setEditingCard(null);
    // The CardEditor will show the clone data
  };

  const handleCancelEdit = () => {
    setShowNewCardForm(false);
    setEditingCard(null);
  };

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
        <CardEditor
          rootDocSelfId={rootDoc.selfId}
          editingCard={editingCard}
          onSave={handleCardSave}
          onCancel={handleCancelEdit}
          onClone={handleCloneCard}
        />
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
                  onRemove={removeCardFromLibrary}
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
            🏛️ Base Game Cards ({hardcodedCardEntries.length}) - Read Only
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 140px))',
            gap: 16,
            justifyContent: 'center'
          }}>
            {hardcodedCardEntries.map(([cardId, card]) => (
              <div 
                key={cardId} 
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
                <Card card={{
                  ...card,
                  createdAt: new Date().toISOString(),
                  createdBy: rootDoc.selfId
                }} />
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
  onCardSelect: (card: CardDoc, isBuiltin: boolean, cardUrl?: AutomergeUrl) => void;
  onRemove?: (cardUrl: AutomergeUrl) => void;
}> = ({ cardUrl, onCardSelect, onRemove }) => {
  const [cardDef] = useDocument<CardDoc>(cardUrl, { suspense: false });

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

  // Card component now expects CardDoc directly
  const cardDoc = cardDef;

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
      <Card card={cardDoc} />
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Are you sure you want to remove "${cardDef.name}" from your library?`)) {
              onRemove(cardUrl);
            }
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: '#ff4444',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 24,
            height: 24,
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
          title="Remove from library"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default CardLibrary;
