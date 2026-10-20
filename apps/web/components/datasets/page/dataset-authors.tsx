"use client";

import type { DatasetAuthor } from "@repo/api/domains/dataset/dataset.schema";

import { DatasetAuthorItem } from "./dataset-author-item";

/** In the order the publisher set, which is the order they are cited in. */
export function DatasetAuthors({ authors }: { authors: DatasetAuthor[] }) {
  const renderAuthor = (author: DatasetAuthor) => (
    <DatasetAuthorItem key={`${author.givenName}-${author.familyName}`} author={author} />
  );

  return <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">{authors.map(renderAuthor)}</ul>;
}
