import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";

export type DeckCard = {
  cardUrl: AutomergeUrl;
  quantity: number; // How many copies of this card in the deck
};

export type DeckDoc = {
  id: string;
  name: string;
  description: string;
  cards: DeckCard[];
  createdAt: string; // ISO timestamp
  createdBy: AutomergeUrl; // Player who created this deck
  updatedAt: string; // ISO timestamp of last modification
};

export const createDeck = (
  repo: Repo,
  deckData: Omit<DeckDoc, 'id' | 'createdAt' | 'updatedAt'>
): DocHandle<DeckDoc> => {
  const now = new Date().toISOString();
  const deck = repo.create<DeckDoc>({
    ...deckData,
    id: `deck_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  });

  return deck;
};

export const addCardToDeck = (deck: DeckDoc, cardUrl: AutomergeUrl, quantity: number = 1): DeckDoc => {
  const existingCard = deck.cards.find(card => card.cardUrl === cardUrl);
  
  if (existingCard) {
    // Update existing card quantity
    return {
      ...deck,
      cards: deck.cards.map(card => 
        card.cardUrl === cardUrl 
          ? { ...card, quantity: card.quantity + quantity }
          : card
      ),
      updatedAt: new Date().toISOString()
    };
  } else {
    // Add new card
    return {
      ...deck,
      cards: [...deck.cards, { cardUrl, quantity }],
      updatedAt: new Date().toISOString()
    };
  }
};

export const removeCardFromDeck = (deck: DeckDoc, cardUrl: AutomergeUrl, quantity: number = 1): DeckDoc => {
  const existingCard = deck.cards.find(card => card.cardUrl === cardUrl);
  
  if (!existingCard) {
    return deck; // Card not in deck
  }
  
  if (existingCard.quantity <= quantity) {
    // Remove card entirely
    return {
      ...deck,
      cards: deck.cards.filter(card => card.cardUrl !== cardUrl),
      updatedAt: new Date().toISOString()
    };
  } else {
    // Reduce quantity
    return {
      ...deck,
      cards: deck.cards.map(card => 
        card.cardUrl === cardUrl 
          ? { ...card, quantity: card.quantity - quantity }
          : card
      ),
      updatedAt: new Date().toISOString()
    };
  }
};

export const updateDeckCardQuantity = (deck: DeckDoc, cardUrl: AutomergeUrl, quantity: number): DeckDoc => {
  if (quantity <= 0) {
    return removeCardFromDeck(deck, cardUrl);
  }
  
  const existingCard = deck.cards.find(card => card.cardUrl === cardUrl);
  
  if (existingCard) {
    // Update quantity
    return {
      ...deck,
      cards: deck.cards.map(card => 
        card.cardUrl === cardUrl 
          ? { ...card, quantity }
          : card
      ),
      updatedAt: new Date().toISOString()
    };
  } else {
    // Add new card with specified quantity
    return {
      ...deck,
      cards: [...deck.cards, { cardUrl, quantity }],
      updatedAt: new Date().toISOString()
    };
  }
};

export const getDeckTotalCards = (deck: DeckDoc): number => {
  return deck.cards.reduce((total, card) => total + card.quantity, 0);
};

export const getDeckUniqueCards = (deck: DeckDoc): number => {
  return deck.cards.length;
};

export const cloneDeck = (deck: DeckDoc, newName: string): Omit<DeckDoc, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    name: newName,
    description: `${deck.description} (Copy)`,
    cards: [...deck.cards], // Copy the cards array
    createdBy: deck.createdBy
  };
};
