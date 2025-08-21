import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { CardType } from "./game";
import { ArtifactAbility } from "../utils/spellEffects";

export type RendererDesc = {
  type: string;
};

export type ImageRendererDesc = {
  type: "image";
  url: string;
};

export type CardDefinition = {
  id: string;
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
  isCustom: boolean; // Always true for user-created cards
};

export const createCardDefinition = (
  repo: Repo, 
  cardData: Omit<CardDefinition, 'createdAt' | 'isCustom'>
): DocHandle<CardDefinition> => {
  const cardDef = repo.create<CardDefinition>({
    ...cardData,
    createdAt: new Date().toISOString(),
    isCustom: true,
  });

  return cardDef;
};
