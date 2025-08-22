import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { CardDoc } from '../docs/card';
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
  const [cardDef] = useDocument<CardDoc>(cardUrl, { suspense: false });

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
        margin: '20px auto',
        padding: '0 24px'
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
            transition: 'all 0.2s ease',
            marginBottom: 20
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
        
        <div style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 12,
          padding: 40,
          color: '#fff',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
          <h3 style={{ margin: '0 0 16px 0', color: '#ff6666' }}>
            Card Not Found
          </h3>
          <p style={{ margin: '0', opacity: 0.8 }}>
            The card you're trying to edit could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 1200,
      margin: '20px auto',
      padding: '0 24px'
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
          transition: 'all 0.2s ease',
          marginBottom: 20
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
