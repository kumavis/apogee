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
  },
  
  // Planet Cards
  'planet_001': {
    id: 'planet_001',
    name: 'Terran Colony',
    cost: 2,
    type: 'planet',
    description: 'A balanced world suitable for diverse infrastructure.',
    planetCapacity: { tech: 2, mechanical: 2, bio: 2, cultural: 1 }
  },
  'planet_002': {
    id: 'planet_002',
    name: 'Industrial Forge World',
    cost: 3,
    type: 'planet',
    description: 'Heavy machinery and tech flourish here.',
    planetCapacity: { tech: 3, mechanical: 3, bio: 1, cultural: 1 }
  },
  'planet_003': {
    id: 'planet_003',
    name: 'Bio-Paradise',
    cost: 2,
    type: 'planet',
    description: 'Lush ecosystem perfect for biological research.',
    planetCapacity: { tech: 1, mechanical: 1, bio: 4, cultural: 2 }
  },
  'planet_004': {
    id: 'planet_004',
    name: 'Cultural Nexus',
    cost: 3,
    type: 'planet',
    description: 'A diplomatic hub of galactic civilization.',
    planetCapacity: { tech: 2, mechanical: 1, bio: 1, cultural: 4 }
  },
  'planet_005': {
    id: 'planet_005',
    name: 'Barren Outpost',
    cost: 1,
    type: 'planet',
    description: 'Remote but cheap to establish.',
    planetCapacity: { tech: 1, mechanical: 1, bio: 1, cultural: 1 }
  },
  'planet_006': {
    id: 'planet_006',
    name: 'Mega Station Alpha',
    cost: 5,
    type: 'planet',
    description: 'Massive space station with unlimited potential.',
    planetCapacity: { tech: 4, mechanical: 4, bio: 3, cultural: 3 }
  },
  
  // Infrastructure Cards - Tech
  'infra_tech_001': {
    id: 'infra_tech_001',
    name: 'Quantum Computer',
    cost: 2,
    type: 'infrastructure',
    description: 'Advanced computing power.',
    infrastructureType: 'tech',
    infrastructureEffects: 'Draw an extra card each turn.'
  },
  'infra_tech_002': {
    id: 'infra_tech_002',
    name: 'Neural Network Hub',
    cost: 3,
    type: 'infrastructure',
    description: 'AI coordination center.',
    infrastructureType: 'tech',
    infrastructureEffects: 'Reduce all spell costs by 1.'
  },
  'infra_tech_003': {
    id: 'infra_tech_003',
    name: 'Research Laboratory',
    cost: 1,
    type: 'infrastructure',
    description: 'Scientific advancement facility.',
    infrastructureType: 'tech',
    infrastructureEffects: 'Gain +1 energy per turn.'
  },
  
  // Infrastructure Cards - Mechanical
  'infra_mech_001': {
    id: 'infra_mech_001',
    name: 'Assembly Line',
    cost: 2,
    type: 'infrastructure',
    description: 'Automated production facility.',
    infrastructureType: 'mechanical',
    infrastructureEffects: 'Creatures cost 1 less energy.'
  },
  'infra_mech_002': {
    id: 'infra_mech_002',
    name: 'Defense Grid',
    cost: 3,
    type: 'infrastructure',
    description: 'Planetary shield generators.',
    infrastructureType: 'mechanical',
    infrastructureEffects: 'Planet owner takes 1 less damage.'
  },
  'infra_mech_003': {
    id: 'infra_mech_003',
    name: 'Mining Operation',
    cost: 1,
    type: 'infrastructure',
    description: 'Resource extraction facility.',
    infrastructureType: 'mechanical',
    infrastructureEffects: 'Artifacts cost 1 less energy.'
  },
  
  // Infrastructure Cards - Bio
  'infra_bio_001': {
    id: 'infra_bio_001',
    name: 'Healing Gardens',
    cost: 2,
    type: 'infrastructure',
    description: 'Regenerative ecosystem.',
    infrastructureType: 'bio',
    infrastructureEffects: 'Restore 1 health per turn.'
  },
  'infra_bio_002': {
    id: 'infra_bio_002',
    name: 'Evolution Chamber',
    cost: 3,
    type: 'infrastructure',
    description: 'Genetic enhancement facility.',
    infrastructureType: 'bio',
    infrastructureEffects: 'All creatures get +1/+1.'
  },
  'infra_bio_003': {
    id: 'infra_bio_003',
    name: 'Symbiotic Network',
    cost: 1,
    type: 'infrastructure',
    description: 'Living communication system.',
    infrastructureType: 'bio',
    infrastructureEffects: 'Creatures enter play refreshed.'
  },
  
  // Infrastructure Cards - Cultural
  'infra_cult_001': {
    id: 'infra_cult_001',
    name: 'Diplomatic Embassy',
    cost: 2,
    type: 'infrastructure',
    description: 'Center of galactic relations.',
    infrastructureType: 'cultural',
    infrastructureEffects: 'Start with +1 extra energy.'
  },
  'infra_cult_002': {
    id: 'infra_cult_002',
    name: 'Academy of Arts',
    cost: 3,
    type: 'infrastructure',
    description: 'Cultural and educational center.',
    infrastructureType: 'cultural',
    infrastructureEffects: 'Maximum hand size +2.'
  },
  'infra_cult_003': {
    id: 'infra_cult_003',
    name: 'Trade Hub',
    cost: 1,
    type: 'infrastructure',
    description: 'Commercial exchange center.',
    infrastructureType: 'cultural',
    infrastructureEffects: 'Draw 2 cards when played.'
  }
};

// Create a standard deck with multiple copies of cards
export const createStandardDeck = (): string[] => {
  const deck: string[] = [];
  
  // Add multiple copies of each card (varying amounts for balance)
  const cardCopies: { [cardId: string]: number } = {
    'card_001': 2, // Cyber Drone
    'card_002': 2, // Plasma Burst
    'card_003': 2, // Steel Sentinel
    'card_004': 2, // Nano Enhancer
    'card_005': 1, // Quantum Destroyer (rare)
    'card_006': 3, // Data Spike (common)
    'card_007': 1, // Bio-Mech Guardian (rare)
    'card_008': 2, // Energy Shield
    'card_009': 2, // Neural Interface
    'card_010': 2, // Fusion Core
    'card_011': 2, // Assault Bot
    'card_012': 1, // System Crash
    'card_013': 2, // Repair Drone
    'card_014': 1, // Photon Cannon (rare)
    'card_015': 2, // Stealth Infiltrator
    
    // Planet cards (1-2 copies each)
    'planet_001': 2, // Terran Colony
    'planet_002': 1, // Industrial Forge World
    'planet_003': 2, // Bio-Paradise
    'planet_004': 1, // Cultural Nexus
    'planet_005': 2, // Barren Outpost
    'planet_006': 1, // Mega Station Alpha (rare)
    
    // Infrastructure cards (2-3 copies each)
    'infra_tech_001': 2, // Quantum Computer
    'infra_tech_002': 1, // Neural Network Hub
    'infra_tech_003': 3, // Research Laboratory (common)
    'infra_mech_001': 2, // Assembly Line
    'infra_mech_002': 1, // Defense Grid
    'infra_mech_003': 3, // Mining Operation (common)
    'infra_bio_001': 2, // Healing Gardens
    'infra_bio_002': 1, // Evolution Chamber
    'infra_bio_003': 3, // Symbiotic Network (common)
    'infra_cult_001': 2, // Diplomatic Embassy
    'infra_cult_002': 1, // Academy of Arts
    'infra_cult_003': 3, // Trade Hub (common)
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
