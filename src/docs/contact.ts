import { DocHandle, Repo } from "@automerge/react";

const adjectives = [
  'Ravenous',
  'Gleaming',
  'Gobbsmacked',
  'Grotesque',
  'Glorious',
  'Graceful',
  'Gargantuan',
  'Timid',
  'Flagrant',
  'Incomprehensible',
  'Incredible',
  'Incredulous',
  'Ironclad',
  'Ironic',
  'Irritating',
  'Evil',
  'Enormous',
  'Enigmatic',
  'Enlightened',
  'Enraged',
  'Enthralling',
  'Envious',
  'Epic',
  'Ethereal',
  'Exalted',
  'Evervescent',
  'Exquisite',
];
const nouns = [
  'Dragon',
  'Knight',
  'Wizard',
  'Elf',
  'Orc',
  'Goblin',
  'Troll',
  'Giant',
  'Dwarf',
  'Hobbit',
  'Zebra',
  'Penguin',
  'Pig',
  'Bear',
  'Tiger',
  'Lion',
  'Elephant',
  'Giraffe',
  'Hippo',
  'Kangaroo',
  'Koala',
  'Leopard',
  'Monkey',
  'Panda',
  'Rabbit',
  'Rhino',
  'Shark',
  'Snake',
  'Wolf',
];

export type ContactDoc = {
  name: string;
};

const makeName = (): string => {
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
};

export const create = (repo: Repo, initialState?: Partial<ContactDoc>): DocHandle<ContactDoc> => {
  const data = {
    name: makeName(),
    ...initialState,
  }
  const handle = repo.create<ContactDoc>(data);
  return handle;
};
