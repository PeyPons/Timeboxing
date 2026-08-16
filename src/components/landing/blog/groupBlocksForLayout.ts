import type {
  BlogBlock,
  HeadingBlock,
  ParagraphBlock,
} from "@/lib/blog/blockSchema";

type BlockGroup =
  | { kind: "prose"; blocks: ParagraphBlock[] }
  | { kind: "subsection"; heading: HeadingBlock; blocks: BlogBlock[] }
  | { kind: "block"; block: BlogBlock };

function isSubheading(block: BlogBlock): block is HeadingBlock {
  return block.type === "heading" && (block.level === 3 || block.level === 4);
}

function isParagraph(block: BlogBlock): block is ParagraphBlock {
  return block.type === "paragraph";
}

/** Agrupa bloques para evitar gap enorme entre párrafos consecutivos o bajo un H3. */
export function groupBlocksForLayout(blocks: BlogBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (isSubheading(block)) {
      const heading = block;
      const body: BlogBlock[] = [];
      i++;
      while (i < blocks.length) {
        const next = blocks[i];
        if (next.type === "heading") break;
        if (
          next.type === "visualRef" ||
          next.type === "callout" ||
          next.type === "cta" ||
          next.type === "table" ||
          next.type === "faq" ||
          next.type === "toc" ||
          next.type === "relatedPost" ||
          next.type === "html"
        ) {
          break;
        }
        body.push(next);
        i++;
      }
      groups.push({ kind: "subsection", heading, blocks: body });
      continue;
    }

    if (isParagraph(block)) {
      const prose: ParagraphBlock[] = [block];
      i++;
      while (i < blocks.length) {
        const next = blocks[i];
        if (!isParagraph(next)) break;
        prose.push(next);
        i++;
      }
      groups.push({ kind: "prose", blocks: prose });
      continue;
    }

    groups.push({ kind: "block", block });
    i++;
  }

  return groups;
}

export function groupKey(group: BlockGroup): string {
  if (group.kind === "prose") return group.blocks.map((b) => b.id).join("-");
  if (group.kind === "subsection") {
    return `${group.heading.id}-${group.blocks.map((b) => b.id).join("-")}`;
  }
  return group.block.id;
}
