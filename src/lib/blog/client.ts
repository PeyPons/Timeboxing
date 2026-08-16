import { supabase } from "@/lib/supabase";
import { safeParseBlocks, BLOCK_SCHEMA_VERSION } from "./blockSchema";
import type {
  BlogPostRecord,
  BlogPostRow,
  BlogPostStatus,
  BlogPostSummary,
} from "./types";

/** Columnas usadas para listado (sin cuerpo) — payload mas pequeno. */
const SUMMARY_COLUMNS =
  "id,slug,status,path_es,path_en,title_es,title_en,description_es,description_en,date,reading_minutes,related_slug,related_slug_en,published_at,updated_at";

/** Columnas completas (incluye blocks_* y json_ld_*). */
const FULL_COLUMNS =
  "id,slug,status,path_es,path_en,title_es,title_en,description_es,description_en,meta_title_es,meta_title_en,meta_description_es,meta_description_en,date,reading_minutes,related_slug,related_slug_en,schema_version,blocks_es,blocks_en,json_ld_es,json_ld_en,published_at,created_at,updated_at";

function rowToRecord(row: BlogPostRow): BlogPostRecord {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    pathEs: row.path_es,
    pathEn: row.path_en,
    titleEs: row.title_es,
    titleEn: row.title_en,
    descriptionEs: row.description_es,
    descriptionEn: row.description_en,
    metaTitleEs: row.meta_title_es,
    metaTitleEn: row.meta_title_en,
    metaDescriptionEs: row.meta_description_es,
    metaDescriptionEn: row.meta_description_en,
    date: row.date,
    readingMinutes: row.reading_minutes,
    relatedSlug: row.related_slug,
    relatedSlugEn: row.related_slug_en,
    schemaVersion: row.schema_version,
    blocksEs: safeParseBlocks(row.blocks_es),
    blocksEn: safeParseBlocks(row.blocks_en),
    jsonLdEs: row.json_ld_es,
    jsonLdEn: row.json_ld_en,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSummary(row: Partial<BlogPostRow> & Pick<BlogPostRow,
  | "id" | "slug" | "status" | "path_es" | "path_en"
  | "title_es" | "title_en" | "description_es" | "description_en"
  | "date" | "reading_minutes" | "related_slug" | "related_slug_en"
  | "published_at" | "updated_at"
>): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    pathEs: row.path_es,
    pathEn: row.path_en,
    titleEs: row.title_es,
    titleEn: row.title_en,
    descriptionEs: row.description_es,
    descriptionEn: row.description_en,
    date: row.date,
    readingMinutes: row.reading_minutes,
    relatedSlug: row.related_slug,
    relatedSlugEn: row.related_slug_en,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

/** Listado publico: solo posts publicados, ordenados por fecha desc. */
export async function listPublishedPostSummaries(): Promise<BlogPostSummary[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SUMMARY_COLUMNS)
    .eq("status", "published")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSummary);
}

/** Listado admin: incluye drafts. */
export async function listAllPostSummaries(): Promise<BlogPostSummary[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SUMMARY_COLUMNS)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSummary);
}

/** Mapa { path_es | path_en } -> id resuelto en runtime para sustituir PUBLIC_PATH_ES_TO_EN del blog. */
export interface BlogPathPair {
  pathEs: string;
  pathEn: string;
}

export async function listPublishedPaths(): Promise<BlogPathPair[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("path_es,path_en")
    .eq("status", "published");
  if (error) throw error;
  return ((data ?? []) as Pick<BlogPostRow, "path_es" | "path_en">[]).map((r) => ({
    pathEs: r.path_es,
    pathEn: r.path_en,
  }));
}

/** Resolucion por URL publica (acepta path ES o EN). */
export async function getPostByPath(pathname: string): Promise<BlogPostRecord | null> {
  const p = pathname.split("?")[0] ?? pathname;
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("status", "published")
    .or(`path_es.eq.${p},path_en.eq.${p}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToRecord(data);
}

/** Busca post por id (admin: incluye drafts; requiere is_platform_admin en RLS). */
export async function getPostById(id: string): Promise<BlogPostRecord | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToRecord(data);
}

/** Busca post por slug (admin: incluye drafts). */
export async function getPostBySlug(slug: string): Promise<BlogPostRecord | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToRecord(data);
}

/** Resumen de un post relacionado (publico, solo published). */
export async function getRelatedSummary(slug: string): Promise<BlogPostSummary | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SUMMARY_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToSummary(data);
}

// ----- Mutaciones admin ---------------------------------------------------

export interface UpsertBlogPostInput {
  id?: string;
  slug: string;
  status: BlogPostStatus;
  pathEs: string;
  pathEn: string;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  metaTitleEs?: string | null;
  metaTitleEn?: string | null;
  metaDescriptionEs?: string | null;
  metaDescriptionEn?: string | null;
  date: string;
  readingMinutes: number;
  relatedSlug?: string | null;
  relatedSlugEn?: string | null;
  blocksEs: unknown;
  blocksEn: unknown;
  jsonLdEs?: Record<string, unknown> | Record<string, unknown>[] | null;
  jsonLdEn?: Record<string, unknown> | Record<string, unknown>[] | null;
}

function inputToRow(input: UpsertBlogPostInput) {
  return {
    slug: input.slug,
    status: input.status,
    path_es: input.pathEs,
    path_en: input.pathEn,
    title_es: input.titleEs,
    title_en: input.titleEn,
    description_es: input.descriptionEs,
    description_en: input.descriptionEn,
    meta_title_es: input.metaTitleEs ?? null,
    meta_title_en: input.metaTitleEn ?? null,
    meta_description_es: input.metaDescriptionEs ?? null,
    meta_description_en: input.metaDescriptionEn ?? null,
    date: input.date,
    reading_minutes: input.readingMinutes,
    related_slug: input.relatedSlug ?? null,
    related_slug_en: input.relatedSlugEn ?? null,
    schema_version: BLOCK_SCHEMA_VERSION,
    blocks_es: input.blocksEs,
    blocks_en: input.blocksEn,
    json_ld_es: input.jsonLdEs ?? null,
    json_ld_en: input.jsonLdEn ?? null,
  };
}

// PostgREST self-hosted devuelve 406 cuando se combina UPDATE/INSERT con
// `return=representation` + Accept singular si las RLS de SELECT no encuentran
// la fila tras la mutacion. Separamos mutacion y SELECT para evitar el problema.

export async function createPost(input: UpsertBlogPostInput): Promise<BlogPostRecord> {
  const { data: inserted, error: insertError } = await supabase
    .from("blog_posts")
    .insert(inputToRow(input))
    .select("id")
    .single();
  if (insertError) throw insertError;
  if (!inserted) throw new Error("No se devolvio el id tras INSERT");
  const created = await getPostBySlug(input.slug);
  if (!created) throw new Error(`Post creado pero no se pudo recuperar (slug=${input.slug})`);
  return created;
}

export async function updatePost(
  id: string,
  input: UpsertBlogPostInput,
): Promise<BlogPostRecord> {
  const { error: updateError } = await supabase
    .from("blog_posts")
    .update(inputToRow(input))
    .eq("id", id);
  if (updateError) throw updateError;
  const { data, error: selectError } = await supabase
    .from("blog_posts")
    .select(FULL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (selectError) throw selectError;
  if (!data) throw new Error(`Post actualizado pero no se pudo recuperar (id=${id})`);
  return rowToRecord(data);
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw error;
}
