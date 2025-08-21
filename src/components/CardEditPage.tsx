import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { CardDefinition } from '../docs/cardDefinition';
import { useGameNavigation } from '../hooks/useGameNavigation';
import CardEditor, { NewCardForm } from './CardEditor';

type CardEditPageProps = {
  rootDoc: RootDocument;
  addCardToLibrary: (cardUrl: AutomergeUrl) => void;
};

const CardEditPage: React.FC<CardEditPageProps> = ({ rootDoc, addCardToLibrary }) => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateToCardLibrary } = useGameNavigation();
  
  // Try to get the card data from URL params
  const cardUrl = cardId as AutomergeUrl;
  const [cardDef] = useDocument<CardDefinition>(cardUrl, { suspense: false });

  // Create editing card state
  const editingCard = cardDef ? {
    card: cardDef,
    isBuiltin: false,
    cardUrl: cardUrl
  } : null;

  const handleCardSave = (savedCardUrl: AutomergeUrl) => {
    // Add to library if it's not already there
    if (!rootDoc.cardLibrary.includes(savedCardUrl)) {
      addCardToLibrary(savedCardUrl);
    }
    
    // Navigate back or to card library
    handleBack();
  };

  const handleClone = (_cardData: NewCardForm) => {
    // For now, just navigate back - the CardEditor will handle the clone
    handleBack();
  };

  const handleBack = () => {
    // Check if there's navigation history
    if (location.key !== 'default') {
      // There's history, go back
      navigate(-1);
    } else {
      // No history, go to card library
      navigateToCardLibrary();
    }
  };

  if (!cardDef) {
    return (
      <div style={{
        maxWidth: 1200,
        margin: '40px auto',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        padding: 24,
        color: '#fff',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontSize: 32, 
          margin: '0 0 24px 0', 
          fontWeight: 600,
          background: 'linear-gradient(135deg, #00ffff 0%, #00ff00 50%, #ff4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ✏️ Edit Card
        </h1>
        <div style={{
          padding: 40,
          opacity: 0.6,
          border: '2px dashed rgba(255,255,255,0.2)',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
          <h3 style={{ margin: '0 0 16px 0', color: '#ff6666' }}>
            Card Not Found
          </h3>
          <p style={{ margin: '0 0 24px 0', opacity: 0.8 }}>
            The card you're trying to edit could not be loaded.
          </p>
          <button
            onClick={handleBack}
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
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

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
          onClick={handleBack}
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
          ← Back
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
          ✏️ Edit Card
        </h1>
        <div style={{ width: 120 }} /> {/* Spacer for centering */}
      </div>

      {/* Card Editor */}
      <CardEditor
        rootDocSelfId={rootDoc.selfId}
        editingCard={editingCard}
        onSave={handleCardSave}
        onCancel={handleBack}
        onClone={handleClone}
      />
    </div>
  );
};

export default CardEditPage;
