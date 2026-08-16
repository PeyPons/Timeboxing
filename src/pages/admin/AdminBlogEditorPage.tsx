import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { useCreatePost, useUpdatePost, blogQueryKeys } from "@/hooks/useBlogPosts";
import { getPostById } from "@/lib/blog/client";
import { BlogBlocksSchema, BlogBlocksDraftSchema } from "@/lib/blog/blockSchema";
import type { BlogBlock, BlogBlockDraft } from "@/lib/blog/blockSchema";
import {
  formToCmsSeed,
  parseBlogCmsSeed,
  pathsFromSlug,
  seedToFormPatch,
} from "@/lib/blog/importSeed";
import type { BlogPostRecord, BlogPostStatus } from "@/lib/blog/types";
import { listVisualIds } from "@/lib/blog/visualRegistry";
import { BlockRenderer } from "@/components/landing/blog/BlockRenderer";
import { BlogBlocksEditor } from "@/components/admin/BlogBlocksEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Eye, AlertCircle, Upload, Download, Code2, Pencil } from "lucide-react";
import { toast } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FormState {
  slug: string;
  status: BlogPostStatus;
  pathEs: string;
  pathEn: string;
  date: string;
  readingMinutes: number;
  relatedSlug: string;
  relatedSlugEn: string;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  metaTitleEs: string;
  metaTitleEn: string;
  metaDescriptionEs: string;
  metaDescriptionEn: string;
  blocksEsRaw: string;
  blocksEnRaw: string;
  jsonLdEsRaw: string;
  jsonLdEnRaw: string;
}

function defaultBlocksJson(paragraphHtml: string): string {
  return JSON.stringify(
    [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        html: paragraphHtml,
      },
    ],
    null,
    2,
  );
}

const FALLBACK_DEFAULT_PARAGRAPH_ES = "Escribe aquí el primer párrafo del artículo.";
const FALLBACK_DEFAULT_PARAGRAPH_EN = "Write the first paragraph of the article here.";

function recordToFormState(
  record: BlogPostRecord | null,
  defaultParagraphs?: { es: string; en: string },
): FormState {
  const paragraphEs = defaultParagraphs?.es ?? FALLBACK_DEFAULT_PARAGRAPH_ES;
  const paragraphEn = defaultParagraphs?.en ?? FALLBACK_DEFAULT_PARAGRAPH_EN;
  if (!record) {
    return {
      slug: "",
      status: "draft",
      pathEs: "/blog/",
      pathEn: "/en/blog/",
      date: new Date().toISOString().slice(0, 10),
      readingMinutes: 5,
      relatedSlug: "",
      relatedSlugEn: "",
      titleEs: "",
      titleEn: "",
      descriptionEs: "",
      descriptionEn: "",
      metaTitleEs: "",
      metaTitleEn: "",
      metaDescriptionEs: "",
      metaDescriptionEn: "",
      blocksEsRaw: defaultBlocksJson(paragraphEs),
      blocksEnRaw: defaultBlocksJson(paragraphEn),
      jsonLdEsRaw: "",
      jsonLdEnRaw: "",
    };
  }
  return {
    slug: record.slug,
    status: record.status,
    pathEs: record.pathEs,
    pathEn: record.pathEn,
    date: record.date,
    readingMinutes: record.readingMinutes,
    relatedSlug: record.relatedSlug ?? "",
    relatedSlugEn: record.relatedSlugEn ?? "",
    titleEs: record.titleEs,
    titleEn: record.titleEn,
    descriptionEs: record.descriptionEs,
    descriptionEn: record.descriptionEn,
    metaTitleEs: record.metaTitleEs ?? "",
    metaTitleEn: record.metaTitleEn ?? "",
    metaDescriptionEs: record.metaDescriptionEs ?? "",
    metaDescriptionEn: record.metaDescriptionEn ?? "",
    blocksEsRaw: JSON.stringify(record.blocksEs, null, 2),
    blocksEnRaw: JSON.stringify(record.blocksEn, null, 2),
    jsonLdEsRaw: record.jsonLdEs ? JSON.stringify(record.jsonLdEs, null, 2) : "",
    jsonLdEnRaw: record.jsonLdEn ? JSON.stringify(record.jsonLdEn, null, 2) : "",
  };
}

function tryParseJson<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: undefined as T };
  try {
    return { ok: true, value: JSON.parse(trimmed) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

function safeParseBlocksRaw(raw: string): BlogBlock[] | string {
  const parsed = tryParseJson<unknown>(raw);
  if (parsed.ok === false) return parsed.error;
  if (parsed.value === undefined) return [];
  const validated = BlogBlocksSchema.safeParse(parsed.value);
  if (!validated.success) {
    return validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return validated.data;
}

function safeParseBlocksDraftRaw(raw: string): BlogBlockDraft[] | string {
  const parsed = tryParseJson<unknown>(raw);
  if (parsed.ok === false) return parsed.error;
  if (parsed.value === undefined) return [];
  const validated = BlogBlocksDraftSchema.safeParse(parsed.value);
  if (!validated.success) {
    return validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return validated.data;
}

export default function AdminBlogEditorPage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isNew = id == null;

  const defaultParagraphs = useMemo(
    () => ({
      es: t("admin.blog.defaultParagraphEs"),
      en: t("admin.blog.defaultParagraphEn"),
    }),
    [t],
  );

  // Cargar el post existente por id (no por slug, porque el slug puede cambiar).
  const { data: existing, isLoading } = useQuery({
    queryKey: id != null ? ["blog", "by-id", id] : ["blog", "by-id", "__noop"],
    queryFn: async () => {
      if (id == null) return null;
      return getPostById(id);
    },
    enabled: id != null,
  });

  const [form, setForm] = useState<FormState>(() => recordToFormState(null, defaultParagraphs));
  const [activeLang, setActiveLang] = useState<"es" | "en">("es");
  const [contentPane, setContentPane] = useState<"edit" | "preview">("edit");
  const [jsonDialogLang, setJsonDialogLang] = useState<"es" | "en" | null>(null);
  const [pathEnTouched, setPathEnTouched] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) {
      setForm(recordToFormState(null, defaultParagraphs));
      setPathEnTouched(false);
      return;
    }
    if (!existing) {
      setForm(recordToFormState(null, defaultParagraphs));
      setPathEnTouched(false);
      return;
    }
    setForm(recordToFormState(existing));
    setPathEnTouched(true);
  }, [isNew, id, existing, defaultParagraphs]);

  const handleSlugChange = (slug: string) => {
    if (isNew && !pathEnTouched) {
      const paths = pathsFromSlug(slug);
      setForm((prev) => ({
        ...prev,
        slug,
        pathEs: paths.pathEs,
        pathEn: paths.pathEn,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, slug }));
  };

  const handleImportSeedFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseBlogCmsSeed(JSON.parse(text));
      if (parsed.ok === false) {
        toast.error(parsed.error);
        return;
      }
      const patch = seedToFormPatch(parsed.seed);
      setForm((prev) => ({ ...prev, ...patch }));
      setPathEnTouched(true);
      toast.success(
        t("admin.blog.importSeedOk"),
      );
    } catch {
      toast.error(t("admin.blog.importSeedErr"));
    }
  };

  const blocksEsResult = useMemo(() => safeParseBlocksRaw(form.blocksEsRaw), [form.blocksEsRaw]);
  const blocksEnResult = useMemo(() => safeParseBlocksRaw(form.blocksEnRaw), [form.blocksEnRaw]);
  const blocksEsDraft = useMemo(() => safeParseBlocksDraftRaw(form.blocksEsRaw), [form.blocksEsRaw]);
  const blocksEnDraft = useMemo(() => safeParseBlocksDraftRaw(form.blocksEnRaw), [form.blocksEnRaw]);
  const blocksEsError = typeof blocksEsResult === "string" ? blocksEsResult : null;
  const blocksEnError = typeof blocksEnResult === "string" ? blocksEnResult : null;
  const blocksEsJsonError = typeof blocksEsDraft === "string" ? blocksEsDraft : null;
  const blocksEnJsonError = typeof blocksEnDraft === "string" ? blocksEnDraft : null;

  const handleExportSeed = () => {
    if (blocksEsError || blocksEnError) {
      toast.error(t("admin.blog.exportSeedInvalid"));
      return;
    }
    const jsonLdEs = tryParseJson<Record<string, unknown> | Record<string, unknown>[]>(
      form.jsonLdEsRaw,
    );
    const jsonLdEn = tryParseJson<Record<string, unknown> | Record<string, unknown>[]>(
      form.jsonLdEnRaw,
    );
    const seed = formToCmsSeed({
      slug: form.slug,
      status: form.status,
      pathEs: form.pathEs,
      pathEn: form.pathEn,
      date: form.date,
      readingMinutes: form.readingMinutes,
      relatedSlug: form.relatedSlug,
      relatedSlugEn: form.relatedSlugEn,
      titleEs: form.titleEs,
      titleEn: form.titleEn,
      descriptionEs: form.descriptionEs,
      descriptionEn: form.descriptionEn,
      metaTitleEs: form.metaTitleEs,
      metaTitleEn: form.metaTitleEn,
      metaDescriptionEs: form.metaDescriptionEs,
      metaDescriptionEn: form.metaDescriptionEn,
      blocksEs: blocksEsResult as BlogBlock[],
      blocksEn: blocksEnResult as BlogBlock[],
      jsonLdEs: jsonLdEs.ok ? (jsonLdEs.value ?? null) : null,
      jsonLdEn: jsonLdEn.ok ? (jsonLdEn.value ?? null) : null,
    });
    const blob = new Blob([JSON.stringify(seed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.slug.trim() || "blog-post"}-cms-seed.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const previewBlocks: BlogBlock[] = activeLang === "es"
    ? (Array.isArray(blocksEsDraft) ? (blocksEsDraft as BlogBlock[]) : [])
    : (Array.isArray(blocksEnDraft) ? (blocksEnDraft as BlogBlock[]) : []);

  const visualIds = useMemo(() => listVisualIds(), []);

  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const validateForm = (): string | null => {
    if (!form.slug.trim()) return t("admin.blog.errSlugRequired");
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      return t("admin.blog.errSlugFormat");
    }
    if (!form.pathEs.startsWith("/blog/")) return t("admin.blog.errPathEs");
    if (!form.pathEn.startsWith("/en/blog/")) return t("admin.blog.errPathEn");
    if (!form.titleEs.trim() || !form.titleEn.trim()) {
      return t("admin.blog.errTitles");
    }
    if (!form.descriptionEs.trim() || !form.descriptionEn.trim()) {
      return t("admin.blog.errDescriptions");
    }
    if (blocksEsError) return t("admin.blog.errBlocksEs") + blocksEsError;
    if (blocksEnError) return t("admin.blog.errBlocksEn") + blocksEnError;
    const jsonLdEs = tryParseJson(form.jsonLdEsRaw);
    if (jsonLdEs.ok === false) return t("admin.blog.errJsonLdEs") + jsonLdEs.error;
    const jsonLdEn = tryParseJson(form.jsonLdEnRaw);
    if (jsonLdEn.ok === false) return t("admin.blog.errJsonLdEn") + jsonLdEn.error;
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }
    const jsonLdEs = tryParseJson<Record<string, unknown> | Record<string, unknown>[]>(form.jsonLdEsRaw);
    const jsonLdEn = tryParseJson<Record<string, unknown> | Record<string, unknown>[]>(form.jsonLdEnRaw);
    const input = {
      slug: form.slug.trim(),
      status: form.status,
      pathEs: form.pathEs.trim(),
      pathEn: form.pathEn.trim(),
      titleEs: form.titleEs.trim(),
      titleEn: form.titleEn.trim(),
      descriptionEs: form.descriptionEs.trim(),
      descriptionEn: form.descriptionEn.trim(),
      metaTitleEs: form.metaTitleEs.trim() || null,
      metaTitleEn: form.metaTitleEn.trim() || null,
      metaDescriptionEs: form.metaDescriptionEs.trim() || null,
      metaDescriptionEn: form.metaDescriptionEn.trim() || null,
      date: form.date,
      readingMinutes: Math.min(239, Math.max(1, form.readingMinutes || 1)),
      relatedSlug: form.relatedSlug.trim() || null,
      relatedSlugEn: form.relatedSlugEn.trim() || null,
      blocksEs: blocksEsResult as BlogBlock[],
      blocksEn: blocksEnResult as BlogBlock[],
      jsonLdEs: jsonLdEs.ok ? (jsonLdEs.value ?? null) : null,
      jsonLdEn: jsonLdEn.ok ? (jsonLdEn.value ?? null) : null,
    };
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(input);
        toast.success(t("admin.blog.created"));
        navigate(`/admin/blog/edit/${created.id}`, { replace: true });
      } else if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, input });
        toast.success(t("admin.blog.saved"));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("admin.blog.errSave");
      toast.error(msg);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/blog")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("admin.blog.backToList")}
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">
            {isNew
              ? t("admin.blog.editorTitleNew")
              : t("admin.blog.editorTitleEdit")}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportSeedFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            {t("admin.blog.importSeed")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportSeed}>
            <Download className="h-4 w-4 mr-1" />
            {t("admin.blog.exportSeed")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {t("common.save")}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Metadatos comunes */}
        <Card>
            <CardHeader>
              <CardTitle>{t("admin.blog.sectionGeneral")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bp-slug">{t("admin.blog.slug")}</Label>
                <Input
                  id="bp-slug"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="mi-articulo-2026"
                />
                <p className="text-xs text-slate-500">
                  {t("admin.blog.slugHelp")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bp-pathEs">{t("admin.blog.pathEs")}</Label>
                  <Input
                    id="bp-pathEs"
                    value={form.pathEs}
                    onChange={(e) => setForm({ ...form, pathEs: e.target.value })}
                    placeholder="/blog/mi-articulo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bp-pathEn">{t("admin.blog.pathEn")}</Label>
                  <Input
                    id="bp-pathEn"
                    value={form.pathEn}
                    onChange={(e) => {
                      setPathEnTouched(true);
                      setForm({ ...form, pathEn: e.target.value });
                    }}
                    placeholder="/en/blog/my-article"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bp-status">{t("admin.blog.status")}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as BlogPostStatus })}
                  >
                    <SelectTrigger id="bp-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">
                        {t("admin.blog.statusDraft")}
                      </SelectItem>
                      <SelectItem value="published">
                        {t("admin.blog.statusPublished")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bp-date">{t("admin.blog.date")}</Label>
                  <Input
                    id="bp-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bp-mins">
                    {t("admin.blog.readingMinutes")}
                  </Label>
                  <Input
                    id="bp-mins"
                    type="number"
                    min={1}
                    max={239}
                    value={form.readingMinutes}
                    onChange={(e) =>
                      setForm({ ...form, readingMinutes: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs ES / EN para textos */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.blog.sectionLocale")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as "es" | "en")}>
                <TabsList>
                  <TabsTrigger value="es">{t("admin.blog.langEs")}</TabsTrigger>
                  <TabsTrigger value="en">{t("admin.blog.langEn")}</TabsTrigger>
                </TabsList>
                {(["es", "en"] as const).map((lng) => (
                  <TabsContent key={lng} value={lng} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                      <Label>
                        {t("admin.blog.title")} ({lng.toUpperCase()})
                      </Label>
                      <Input
                        value={lng === "es" ? form.titleEs : form.titleEn}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            ...(lng === "es"
                              ? { titleEs: e.target.value }
                              : { titleEn: e.target.value }),
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {t("admin.blog.description")} ({lng.toUpperCase()})
                      </Label>
                      <Textarea
                        rows={3}
                        value={lng === "es" ? form.descriptionEs : form.descriptionEn}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            ...(lng === "es"
                              ? { descriptionEs: e.target.value }
                              : { descriptionEn: e.target.value }),
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {lng === "es"
                          ? t("admin.blog.relatedSlug")
                          : t("admin.blog.relatedSlugEn")}
                      </Label>
                      <Input
                        className="font-mono text-sm"
                        value={lng === "es" ? form.relatedSlug : form.relatedSlugEn}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            ...(lng === "es"
                              ? { relatedSlug: e.target.value }
                              : { relatedSlugEn: e.target.value }),
                          })
                        }
                        placeholder="que-es-timeboxing"
                      />
                      {lng === "en" && (
                        <p className="text-xs text-slate-500">
                          {t("admin.blog.relatedSlugEnHint")}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {t("admin.blog.metaTitle")} ({lng.toUpperCase()})
                      </Label>
                      <Input
                        value={lng === "es" ? form.metaTitleEs : form.metaTitleEn}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            ...(lng === "es"
                              ? { metaTitleEs: e.target.value }
                              : { metaTitleEn: e.target.value }),
                          })
                        }
                        placeholder={t("admin.blog.metaTitleHint")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {t("admin.blog.metaDescription")} (
                        {lng.toUpperCase()})
                      </Label>
                      <Textarea
                        rows={2}
                        value={lng === "es" ? form.metaDescriptionEs : form.metaDescriptionEn}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            ...(lng === "es"
                              ? { metaDescriptionEs: e.target.value }
                              : { metaDescriptionEn: e.target.value }),
                          })
                        }
                        placeholder={t("admin.blog.metaDescriptionHint")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {t("admin.blog.jsonLd")} ({lng.toUpperCase()})
                      </Label>
                      <Textarea
                        rows={6}
                        className="font-mono text-xs"
                        placeholder={t("admin.blog.jsonLdHint")}
                        value={lng === "es" ? form.jsonLdEsRaw : form.jsonLdEnRaw}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            ...(lng === "es"
                              ? { jsonLdEsRaw: e.target.value }
                              : { jsonLdEnRaw: e.target.value }),
                          })
                        }
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

        {/* Contenido del artículo — editor visual + preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle>{t("admin.blog.sectionContent")}</CardTitle>
            <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as "es" | "en")}>
              <TabsList>
                <TabsTrigger value="es">{t("admin.blog.langEs")}</TabsTrigger>
                <TabsTrigger value="en">{t("admin.blog.langEn")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {(["es", "en"] as const).map((lng) => {
              if (lng !== activeLang) return null;
              const draftBlocks = lng === "es" ? blocksEsDraft : blocksEnDraft;
              const jsonError = lng === "es" ? blocksEsJsonError : blocksEnJsonError;
              const publishError = lng === "es" ? blocksEsError : blocksEnError;
              const rawKey = lng === "es" ? "blocksEsRaw" : "blocksEnRaw";

              return (
                <div key={lng} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tabs value={contentPane} onValueChange={(v) => setContentPane(v as "edit" | "preview")}>
                      <TabsList className="h-8 xl:hidden">
                        <TabsTrigger value="edit" className="h-7 text-xs gap-1">
                          <Pencil className="h-3.5 w-3.5" />
                          {t("admin.blog.contentTabEdit")}
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="h-7 text-xs gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {t("admin.blog.contentTabPreview")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setJsonDialogLang(lng)}
                    >
                      <Code2 className="h-3.5 w-3.5 mr-1" />
                      {t("admin.blog.blocksJsonAdvanced")}
                    </Button>
                  </div>

                  {publishError != null && jsonError == null && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {t("admin.blog.blocksDraftWarning")}{" "}
                      {publishError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className={contentPane === "preview" ? "hidden xl:block" : undefined}>
                      {jsonError != null ? (
                        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-4">
                          <p className="text-xs text-red-700 inline-flex items-start gap-1">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            {t("admin.blog.blocksJsonBroken")}{" "}
                            {jsonError}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setJsonDialogLang(lng)}
                          >
                            {t("admin.blog.openJsonEditor")}
                          </Button>
                        </div>
                      ) : (
                        <BlogBlocksEditor
                          blocks={draftBlocks as BlogBlockDraft[]}
                          visualIds={visualIds}
                          onChange={(next) =>
                            setForm({
                              ...form,
                              [rawKey]: JSON.stringify(next, null, 2),
                            })
                          }
                          labels={{
                            addBlock: t("admin.blog.addBlock"),
                            block: t("admin.blog.block"),
                            remove: t("common.delete"),
                            moveUp: t("admin.blog.moveUp"),
                            moveDown: t("admin.blog.moveDown"),
                            type: t("admin.blog.blockType"),
                            html: t("admin.blog.html"),
                            htmlHint: t("admin.blog.htmlHint"),
                            text: t("admin.blog.text"),
                            level: t("admin.blog.level"),
                            anchorId: t("admin.blog.anchorId"),
                            tone: t("admin.blog.tone"),
                            ordered: t("admin.blog.orderedList"),
                            items: t("admin.blog.items"),
                            headers: t("admin.blog.tableHeaders"),
                            rows: t("admin.blog.tableRows"),
                            question: t("admin.blog.faqQ"),
                            answer: t("admin.blog.faqA"),
                            slug: t("admin.blog.relatedSlugField"),
                            href: t("admin.blog.href"),
                            variant: t("admin.blog.variant"),
                            visualId: t("admin.blog.visualId"),
                            addItem: t("admin.blog.addItem"),
                            tocHint: t("admin.blog.tocHint"),
                            blocksCount: t("admin.blog.blocksCountLabel"),
                          }}
                        />
                      )}
                    </div>

                    <div
                      className={cn(
                        "space-y-2",
                        contentPane === "edit" ? "hidden xl:block" : undefined,
                      )}
                    >
                      <Label className="inline-flex items-center gap-2 text-sm">
                        <Eye className="h-4 w-4" />
                        {t("admin.blog.preview")}
                        <span className="text-xs font-normal text-slate-500">
                          ({previewBlocks.length}{" "}
                          {t("admin.blog.blockCount")})
                        </span>
                      </Label>
                      <div className="rounded-2xl border border-slate-300 bg-gradient-to-br from-indigo-950 via-purple-950 to-indigo-900 p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-2">
                          {lng === "es" ? form.titleEs : form.titleEn}
                        </h2>
                        <p className="text-indigo-100/80 text-sm mb-6">
                          {lng === "es" ? form.descriptionEs : form.descriptionEn}
                        </p>
                        <BlockRenderer blocks={previewBlocks} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("admin.blog.previewHint")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
            {t("admin.blog.visualRefIds")}
          </summary>
          <div className="px-4 pb-4">
            <ul className="text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {visualIds.map((v) => (
                <li key={v.id} className="font-mono">
                  {v.id}{" "}
                  <span className="text-slate-400">({v.mode})</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>

      <Dialog open={jsonDialogLang != null} onOpenChange={(open) => !open && setJsonDialogLang(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("admin.blog.blocksJsonAdvanced")}{" "}
              ({jsonDialogLang?.toUpperCase()})
            </DialogTitle>
            <DialogDescription>
              {t("admin.blog.blocksJsonAdvancedHint")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={22}
            className="font-mono text-xs"
            value={jsonDialogLang === "es" ? form.blocksEsRaw : form.blocksEnRaw}
            onChange={(e) =>
              setForm({
                ...form,
                ...(jsonDialogLang === "es"
                  ? { blocksEsRaw: e.target.value }
                  : { blocksEnRaw: e.target.value }),
              })
            }
          />
          {(jsonDialogLang === "es" ? blocksEsJsonError : blocksEnJsonError) != null && (
            <p className="text-xs text-red-600 inline-flex items-start gap-1">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {jsonDialogLang === "es" ? blocksEsJsonError : blocksEnJsonError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
