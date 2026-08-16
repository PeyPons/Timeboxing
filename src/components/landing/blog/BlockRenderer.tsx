import type {
  BlogBlock,
  HeadingBlock as HeadingBlockData,
} from "@/lib/blog/blockSchema";
import { ParagraphBlock } from "./blocks/ParagraphBlock";
import { HeadingBlock } from "./blocks/HeadingBlock";
import { CalloutBlock } from "./blocks/CalloutBlock";
import { ListBlock } from "./blocks/ListBlock";
import { TableBlock } from "./blocks/TableBlock";
import { FaqBlock } from "./blocks/FaqBlock";
import { TocBlock } from "./blocks/TocBlock";
import { RelatedPostBlock } from "./blocks/RelatedPostBlock";
import { HtmlBlock } from "./blocks/HtmlBlock";
import { CtaBlock } from "./blocks/CtaBlock";
import { VisualRefBlock } from "./blocks/VisualRefBlock";
import { groupBlocksForLayout, groupKey } from "./groupBlocksForLayout";

interface BlockRendererProps {
  blocks: BlogBlock[];
}

function isH2(block: BlogBlock): block is HeadingBlockData {
  return block.type === "heading" && block.level === 2;
}

function splitIntoSections(blocks: BlogBlock[]) {
  const intro: BlogBlock[] = [];
  const sections: { heading: HeadingBlockData; blocks: BlogBlock[] }[] = [];

  let i = 0;
  while (i < blocks.length && !isH2(blocks[i])) {
    intro.push(blocks[i]);
    i++;
  }

  while (i < blocks.length) {
    if (!isH2(blocks[i])) {
      intro.push(blocks[i]);
      i++;
      continue;
    }
    const heading = blocks[i];
    const sectionBlocks: BlogBlock[] = [];
    i++;
    while (i < blocks.length && !isH2(blocks[i])) {
      sectionBlocks.push(blocks[i]);
      i++;
    }
    sections.push({ heading, blocks: sectionBlocks });
  }

  return { intro, sections };
}

function renderBlock(block: BlogBlock, allBlocks: BlogBlock[]) {
  switch (block.type) {
    case "paragraph":
      return <ParagraphBlock block={block} />;
    case "heading":
      return <HeadingBlock block={block} />;
    case "callout":
      return <CalloutBlock block={block} />;
    case "list":
      return <ListBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "faq":
      return <FaqBlock block={block} />;
    case "toc":
      return <TocBlock allBlocks={allBlocks} />;
    case "relatedPost":
      return <RelatedPostBlock block={block} />;
    case "html":
      return <HtmlBlock block={block} />;
    case "cta":
      return <CtaBlock block={block} />;
    case "visualRef":
      return <VisualRefBlock block={block} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

function blockWrapperClass(block: BlogBlock): string | undefined {
  if (block.type === "visualRef") return "py-1 sm:py-2";
  if (block.type === "table") return undefined;
  return "w-full max-w-3xl mx-auto";
}

function renderBlockGroup(group: ReturnType<typeof groupBlocksForLayout>[number], allBlocks: BlogBlock[]) {
  if (group.kind === "prose") {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-3 sm:space-y-3.5 text-indigo-100/90">
        {group.blocks.map((block) => (
          <ParagraphBlock key={block.id} block={block} />
        ))}
      </div>
    );
  }

  if (group.kind === "subsection") {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-2.5 sm:space-y-3">
        <HeadingBlock block={group.heading} />
        {group.blocks.length > 0 && (
          <div className="space-y-3 sm:space-y-3.5 sm:border-l-2 sm:border-indigo-400/20 sm:pl-5">
            {group.blocks.map((block) => (
              <div key={block.id} data-block-type={block.type}>
                {renderBlock(block, allBlocks)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div key={group.block.id} data-block-type={group.block.type} className={blockWrapperClass(group.block)}>
      {renderBlock(group.block, allBlocks)}
    </div>
  );
}

export function BlockRenderer({ blocks }: BlockRendererProps) {
  const { intro, sections } = splitIntoSections(blocks);

  return (
    <>
      {intro.length > 0 && (
        <div className="flex flex-col gap-5 sm:gap-6 mb-8 sm:mb-12">
          {groupBlocksForLayout(intro).map((group) => (
            <div key={groupKey(group)}>{renderBlockGroup(group, blocks)}</div>
          ))}
        </div>
      )}

      {sections.map(({ heading, blocks: sectionBlocks }) => (
        <section
          key={heading.id}
          aria-labelledby={heading.anchorId}
          className="flex flex-col gap-5 sm:gap-6 mb-10 sm:mb-14 pt-6 sm:pt-8 border-t border-white/10 scroll-mt-24"
        >
          <HeadingBlock block={{ ...heading, level: 2 }} sectionLead />
          {groupBlocksForLayout(sectionBlocks).map((group) => (
            <div key={groupKey(group)}>{renderBlockGroup(group, blocks)}</div>
          ))}
        </section>
      ))}
    </>
  );
}
