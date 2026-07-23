import { docs } from "@/.source/server";
import type * as PageTree from "fumadocs-core/page-tree";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});

function sectionTree(folder: string): PageTree.Root {
  const node = source.pageTree.children.find(
    (child): child is PageTree.Folder =>
      child.type === "folder" &&
      (child.$ref?.folder === folder || child.index?.url === `/${folder}`),
  );

  return {
    name: node?.name ?? folder,
    children: node?.children ?? [],
  };
}

export const guideTree = sectionTree("guide");
export const developersTree = sectionTree("developers");
