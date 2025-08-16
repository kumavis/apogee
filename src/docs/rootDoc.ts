import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { ContactDoc, create as createContact } from "./contact";

const ROOT_DOC_URL_KEY = "root-doc-url";

export type RootDocument = {
  selfId: AutomergeUrl;
  games: AutomergeUrl[];
};

const createRootDoc = (repo: Repo): DocHandle<RootDocument> => {
  const contact = repo.create<ContactDoc>();
  createContact(contact);

  const root = repo.create<RootDocument>({
    selfId: contact.url,
    games: [],
  });

  return root;
}

export const setRootDocUrl = (url: AutomergeUrl): void => {
  localStorage.setItem(ROOT_DOC_URL_KEY, url);
};

export const getOrCreateRoot = (repo: Repo): AutomergeUrl => {
  // Check if we already have a root document
  const existingId = localStorage.getItem(ROOT_DOC_URL_KEY);
  if (existingId) {
    return existingId as AutomergeUrl;
  }

  const root = createRootDoc(repo);
  
  localStorage.setItem(ROOT_DOC_URL_KEY, root.url);
  return root.url;
};

export const deleteRootDoc = (): void => {
  localStorage.removeItem(ROOT_DOC_URL_KEY);
};
