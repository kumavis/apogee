import { AutomergeUrl, useDocument } from "@automerge/react";
import { CardDoc } from "../../docs/card";
import Card, { BaseCardProps } from "./Card";

type LazyCardProps = BaseCardProps & {
  url: AutomergeUrl;
};

const LazyCard: React.FC<LazyCardProps> = ({ url, ...cardProps }) => {
  const [cardDoc] = useDocument<CardDoc>(url, { suspense: false });
  if (!cardDoc) {
    return <Card card={{
      name: 'Loading...',
      cost: 0,
      attack: 0,
      health: 0,
      type: 'creature',
      description: 'Loading...',
      createdAt: new Date().toISOString(),
      createdBy: 'test' as AutomergeUrl,
    }} {...cardProps} />;
  }
  return <Card card={cardDoc} {...cardProps} />;
};

export default LazyCard;