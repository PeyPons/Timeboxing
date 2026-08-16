import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPost,
  deletePost,
  getPostByPath,
  getRelatedSummary,
  listAllPostSummaries,
  listPublishedPaths,
  listPublishedPostSummaries,
  updatePost,
  type UpsertBlogPostInput,
} from "@/lib/blog/client";
import type { BlogPostRecord } from "@/lib/blog/types";

const STALE_5_MIN = 5 * 60 * 1000;
const STALE_30_MIN = 30 * 60 * 1000;

export const blogQueryKeys = {
  all: ["blog"] as const,
  publicSummaries: ["blog", "public-summaries"] as const,
  adminSummaries: ["blog", "admin-summaries"] as const,
  paths: ["blog", "paths"] as const,
  byPath: (path: string) => ["blog", "by-path", path] as const,
  relatedSummary: (slug: string) => ["blog", "related-summary", slug] as const,
};

/** Listado publico (solo published). */
export function usePublishedPostSummaries() {
  return useQuery({
    queryKey: blogQueryKeys.publicSummaries,
    queryFn: listPublishedPostSummaries,
    staleTime: STALE_5_MIN,
    gcTime: STALE_30_MIN,
  });
}

/** Listado admin (incluye drafts). */
export function useAllPostSummaries(enabled = true) {
  return useQuery({
    queryKey: blogQueryKeys.adminSummaries,
    queryFn: listAllPostSummaries,
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Mapa de paths para hreflang/canonical. Cachea agresivamente; admin invalida en mutaciones. */
export function usePublishedPathPairs() {
  return useQuery({
    queryKey: blogQueryKeys.paths,
    queryFn: listPublishedPaths,
    staleTime: STALE_30_MIN,
    gcTime: STALE_30_MIN * 2,
  });
}

/** Resolucion por URL publica (path ES o EN). */
export function usePostByPath(pathname: string | undefined) {
  return useQuery({
    queryKey: pathname != null ? blogQueryKeys.byPath(pathname) : ["blog", "by-path", "__noop"],
    queryFn: () => (pathname != null ? getPostByPath(pathname) : Promise.resolve(null)),
    enabled: pathname != null && pathname.length > 0,
    staleTime: STALE_5_MIN,
  });
}

/** Resumen de post relacionado (para BlogRelatedPost). */
export function useRelatedSummary(slug: string | null | undefined) {
  return useQuery({
    queryKey: slug != null && slug.length > 0
      ? blogQueryKeys.relatedSummary(slug)
      : ["blog", "related-summary", "__noop"],
    queryFn: () => (slug != null && slug.length > 0 ? getRelatedSummary(slug) : Promise.resolve(null)),
    enabled: slug != null && slug.length > 0,
    staleTime: STALE_5_MIN,
  });
}

// ----- Mutaciones admin --------------------------------------------------

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: blogQueryKeys.all });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertBlogPostInput) => createPost(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertBlogPostInput }) =>
      updatePost(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => invalidateAll(qc),
  });
}

// ----- Helpers ----------------------------------------------------------

/** Empareja paths del blog desde la BD para reemplazar el mapa estatico. */
export function buildBlogPathMaps(pairs: { pathEs: string; pathEn: string }[]): {
  esToEn: Map<string, string>;
  enToEs: Map<string, string>;
} {
  const esToEn = new Map<string, string>();
  const enToEs = new Map<string, string>();
  for (const p of pairs) {
    esToEn.set(p.pathEs, p.pathEn);
    enToEs.set(p.pathEn, p.pathEs);
  }
  return { esToEn, enToEs };
}

/** Util tipo guard para detectar BlogPostRecord en componentes. */
export function isBlogPostRecord(v: unknown): v is BlogPostRecord {
  return (
    v != null
    && typeof v === "object"
    && "slug" in v
    && "blocksEs" in v
  );
}
