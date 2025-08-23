import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { ArtifactAbility } from "../utils/spellEffects";

export type CardType = 'creature' | 'spell' | 'artifact';

export type RendererDesc = {
  type: string;
};

export type ImageRendererDesc = {
  type: "image";
  url: string;
};

// Unified card document type - no longer needs an id field since AutomergeUrl serves as the ID
export type CardDoc = {
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: CardType;
  description: string;
  spellEffect?: string; // Code string for spell effects
  triggeredAbilities?: ArtifactAbility[]; // Array of triggered abilities for creatures and artifacts
  renderer?: RendererDesc | null; // Optional custom renderer for the card
  createdAt: string; // ISO timestamp
  createdBy: AutomergeUrl; // Player who created this card
  attackTargeting?: {
    canTargetPlayers?: boolean;
    canTargetCreatures?: boolean;
    canTargetArtifacts?: boolean;
    restrictedTypes?: ('creature' | 'artifact')[];
    description?: string;
  };
};

export const createCard = (
  repo: Repo, 
  cardData: Omit<CardDoc, 'createdAt'>
): DocHandle<CardDoc> => {
  const cardDoc = repo.create<CardDoc>({
    ...cardData,
    createdAt: new Date().toISOString(),
  });

  return cardDoc;
};