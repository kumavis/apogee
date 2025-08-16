import { DocHandle } from "@automerge/react";

export type ContactDoc = {
  name: string;
};

export const create = (handle: DocHandle<ContactDoc>, initialState?: Partial<ContactDoc>): void => {
  handle.update((doc) => {
    Object.assign(doc, initialState);
    return doc;
  });
};
