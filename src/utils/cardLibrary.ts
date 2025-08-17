import { GameCard } from '../docs/game';

// Sci-fi themed card library
export const CARD_LIBRARY: { [cardId: string]: GameCard } = {
  'card_001': {
    id: 'card_001',
    name: 'Cyber Drone',
    cost: 2,
    attack: 2,
    health: 1,
    type: 'creature',
    description: 'A fast reconnaissance unit.'
  },
  'card_002': {
    id: 'card_002',
    name: 'Plasma Burst',
    cost: 3,
    type: 'spell',
    description: 'Deal 3 energy damage to any target.'
  },
  'card_003': {
    id: 'card_003',
    name: 'Steel Sentinel',
    cost: 4,
    attack: 2,
    health: 6,
    type: 'creature',
    description: 'An automated defense unit.'
  },
  'card_004': {
    id: 'card_004',
    name: 'Nano Enhancer',
    cost: 2,
    type: 'artifact',
    description: 'Equipped unit gains +2/+1.'
  },
  'card_005': {
    id: 'card_005',
    name: 'Quantum Destroyer',
    cost: 5,
    attack: 4,
    health: 3,
    type: 'creature',
    description: 'A cybernetic war machine from the future.'
  },
  'card_006': {
    id: 'card_006',
    name: 'Data Spike',
    cost: 1,
    type: 'spell',
    description: 'Hack enemy systems for 1 damage.'
  },
  'card_007': {
    id: 'card_007',
    name: 'Bio-Mech Guardian',
    cost: 6,
    attack: 5,
    health: 5,
    type: 'creature',
    description: 'Protects all allied units.'
  },
  'card_008': {
    id: 'card_008',
    name: 'Energy Shield',
    cost: 3,
    attack: 1,
    health: 4,
    type: 'creature',
    description: 'Deflects incoming attacks.'
  },
  'card_009': {
    id: 'card_009',
    name: 'Neural Interface',
    cost: 1,
    type: 'artifact',
    description: 'Draw an additional card each turn.'
  },
  'card_010': {
    id: 'card_010',
    name: 'Fusion Core',
    cost: 4,
    type: 'artifact',
    description: 'Gain +1 energy per turn.'
  },
  'card_011': {
    id: 'card_011',
    name: 'Assault Bot',
    cost: 3,
    attack: 3,
    health: 2,
    type: 'creature',
    description: 'Fast attack unit.'
  },
  'card_012': {
    id: 'card_012',
    name: 'System Crash',
    cost: 4,
    type: 'spell',
    description: 'Destroy target artifact or spell.'
  },
  'card_013': {
    id: 'card_013',
    name: 'Repair Drone',
    cost: 2,
    attack: 1,
    health: 3,
    type: 'creature',
    description: 'Restore 2 health to target unit.'
  },
  'card_014': {
    id: 'card_014',
    name: 'Photon Cannon',
    cost: 5,
    type: 'spell',
    description: 'Deal 5 damage to target.'
  },
  'card_015': {
    id: 'card_015',
    name: 'Stealth Infiltrator',
    cost: 2,
    attack: 1,
    health: 1,
    type: 'creature',
    description: 'Cannot be blocked.'
  }
};

// Create a standard deck with multiple copies of cards
export const createStandardDeck = (): string[] => {
  const deck: string[] = [];
  
  // Add multiple copies of each card (varying amounts for balance)
  const cardCopies: { [cardId: string]: number } = {
    'card_001': 3, // Cyber Drone
    'card_002': 2, // Plasma Burst
    'card_003': 2, // Steel Sentinel
    'card_004': 3, // Nano Enhancer
    'card_005': 1, // Quantum Destroyer (rare)
    'card_006': 4, // Data Spike (common)
    'card_007': 1, // Bio-Mech Guardian (rare)
    'card_008': 3, // Energy Shield
    'card_009': 2, // Neural Interface
    'card_010': 2, // Fusion Core
    'card_011': 3, // Assault Bot
    'card_012': 2, // System Crash
    'card_013': 3, // Repair Drone
    'card_014': 1, // Photon Cannon (rare)
    'card_015': 3, // Stealth Infiltrator
  };
  
  // Add cards to deck based on copy counts
  Object.entries(cardCopies).forEach(([cardId, count]) => {
    for (let i = 0; i < count; i++) {
      deck.push(cardId);
    }
  });
  
  return deck;
};

// Shuffle an array (Fisher-Yates algorithm)
export const shuffleDeck = (deck: string[]): string[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Draw cards from deck
export const drawCards = (deck: string[], count: number): { drawnCards: string[], remainingDeck: string[] } => {
  const drawnCards = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { drawnCards, remainingDeck };
};
