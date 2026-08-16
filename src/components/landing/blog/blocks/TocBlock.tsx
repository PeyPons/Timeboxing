import { BlogTOC, type BlogTOCItem } from "../BlogTOC";
import type { BlogBlock } from "@/lib/blog/blockSchema";

/**
 * El bloque TOC se compone automaticamente desde los heading blocks que tienen
 * anchorId definido. Si no hay headings con anchorId, no se renderiza.
 */
export function TocBlock({ allBlocks }: { allBlocks: BlogBlock[] }) {
  const items: BlogTOCItem[] = allBlocks.flatMap((block) => {
    if (
      block.type !== "heading" ||
      typeof block.anchorId !== "string" ||
      block.anchorId.length === 0
    ) {
      return [];
    }
    return [{ id: block.anchorId, label: block.text }];
  });

  if (items.length === 0) return null;
  return (
    <div className="m-0">
      <BlogTOC items={items} />
    </div>
  );
}
