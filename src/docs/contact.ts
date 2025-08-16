export type ContactDoc = {
  name: string;
  email: string;
  avatar?: string;
  createdAt: number;
};

export const create = (name?: string, doc?: any): void => {
  if (doc) {
    doc.name = name || "Anonymous";
    doc.email = "";
    doc.avatar = "";
    doc.createdAt = Date.now();
  }
};
