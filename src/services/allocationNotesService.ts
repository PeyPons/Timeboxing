import { format, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { AllocationNote, AllocationNoteSource } from '@/types';

const NOTES_LIMIT = 50;
export const ALLOCATION_NOTE_MAX_LENGTH = 10_000;

interface SupabaseAllocationNoteRow {
  id: string;
  allocation_id: string;
  agency_id: string;
  author_employee_id: string | null;
  body: string;
  source: AllocationNoteSource;
  created_at: string;
  deleted_at: string | null;
  author?:
    | { id: string; name: string; avatar_url: string | null }
    | { id: string; name: string; avatar_url: string | null }[]
    | null;
}

interface AllocationNoteCountRow {
  allocation_id: string;
  note_count: number;
}

interface AllocationNoteListRpcRow {
  id: string;
  allocation_id: string;
  agency_id: string;
  author_employee_id: string | null;
  body: string;
  source: AllocationNoteSource;
  created_at: string;
  deleted_at: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
}

function mapNote(row: SupabaseAllocationNoteRow): AllocationNote {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    id: row.id,
    allocationId: row.allocation_id,
    agencyId: row.agency_id,
    authorEmployeeId: row.author_employee_id,
    body: row.body,
    source: row.source,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    authorName: author?.name,
    authorAvatarUrl: author?.avatar_url ?? null,
  };
}

function mapNoteFromRpcRow(row: AllocationNoteListRpcRow): AllocationNote {
  return {
    id: row.id,
    allocationId: row.allocation_id,
    agencyId: row.agency_id,
    authorEmployeeId: row.author_employee_id,
    body: row.body,
    source: row.source,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    authorName: row.author_name ?? undefined,
    authorAvatarUrl: row.author_avatar_url ?? null,
  };
}

function rowsToCountMap(rows: AllocationNoteCountRow[] | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.allocation_id] = Number(row.note_count) || 0;
  }
  return counts;
}

export async function fetchAllocationNotes(allocationId: string): Promise<AllocationNote[]> {
  const { data, error } = await supabase
    .from('allocation_notes')
    .select(
      `
      id,
      allocation_id,
      agency_id,
      author_employee_id,
      body,
      source,
      created_at,
      deleted_at,
      author:employees!allocation_notes_author_employee_id_fkey (
        id,
        name,
        avatar_url
      )
    `
    )
    .eq('allocation_id', allocationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(NOTES_LIMIT);

  if (error) throw error;
  return (data ?? []).map(row => mapNote(row as SupabaseAllocationNoteRow));
}

/** Conteos para un conjunto explícito de allocations (p. ej. tareas visibles en Mi día). */
export async function fetchAllocationNoteCounts(
  allocationIds: string[],
  agencyId: string,
): Promise<Record<string, number>> {
  if (allocationIds.length === 0 || !agencyId) return {};

  const uniqueIds = [...new Set(allocationIds)];
  const { data, error } = await supabase.rpc('count_allocation_notes_for_ids', {
    p_agency_id: agencyId,
    p_allocation_ids: uniqueIds,
  });

  if (error) throw error;
  return rowsToCountMap((data ?? []) as AllocationNoteCountRow[]);
}

/** Conteos del planificador: empleado + mes efectivo (week_start_date en ese mes). */
export async function fetchAllocationNoteCountsForEmployeeMonth(
  agencyId: string,
  employeeId: string,
  viewMonth: Date,
): Promise<Record<string, number>> {
  if (!agencyId || !employeeId) return {};

  const { data, error } = await supabase.rpc('count_allocation_notes_for_employee_month', {
    p_agency_id: agencyId,
    p_employee_id: employeeId,
    p_month: format(startOfMonth(viewMonth), 'yyyy-MM-dd'),
  });

  if (error) throw error;
  return rowsToCountMap((data ?? []) as AllocationNoteCountRow[]);
}

export async function fetchAllocationNotesForIds(
  allocationIds: string[],
  agencyId: string,
): Promise<AllocationNote[]> {
  if (allocationIds.length === 0 || !agencyId) return [];

  const uniqueIds = [...new Set(allocationIds)];
  const { data, error } = await supabase.rpc('list_allocation_notes_for_ids', {
    p_agency_id: agencyId,
    p_allocation_ids: uniqueIds,
  });

  if (error) throw error;
  return ((data ?? []) as AllocationNoteListRpcRow[]).map(mapNoteFromRpcRow);
}

export async function createAllocationNote(params: {
  allocationId: string;
  agencyId: string;
  authorEmployeeId: string;
  body: string;
}): Promise<AllocationNote> {
  const trimmed = params.body.trim();
  if (!trimmed) throw new Error('La anotación no puede estar vacía');
  if (trimmed.length > ALLOCATION_NOTE_MAX_LENGTH) {
    throw new Error(`La anotación no puede superar ${ALLOCATION_NOTE_MAX_LENGTH} caracteres`);
  }

  const { data, error } = await supabase
    .from('allocation_notes')
    .insert({
      allocation_id: params.allocationId,
      agency_id: params.agencyId,
      author_employee_id: params.authorEmployeeId,
      body: trimmed,
      source: 'user',
    })
    .select(
      `
      id,
      allocation_id,
      agency_id,
      author_employee_id,
      body,
      source,
      created_at,
      deleted_at,
      author:employees!allocation_notes_author_employee_id_fkey (
        id,
        name,
        avatar_url
      )
    `
    )
    .single();

  if (error) throw error;
  return mapNote(data as SupabaseAllocationNoteRow);
}

export async function softDeleteAllocationNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('allocation_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .is('deleted_at', null);

  if (error) throw error;
}

export async function copyAllocationNotes(fromAllocationId: string, toAllocationId: string): Promise<number> {
  const { data, error } = await supabase.rpc('copy_allocation_notes', {
    p_from: fromAllocationId,
    p_to: toAllocationId,
    p_source: 'system_copy',
  });

  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** Búsqueda en notas dentro de un conjunto acotado de allocations (Mi día, etc.). */
export async function searchAllocationIdsByNoteBody(
  allocationIds: string[],
  needle: string,
  agencyId: string,
): Promise<Set<string>> {
  const q = needle.trim();
  if (!q || allocationIds.length === 0 || !agencyId) return new Set();

  const uniqueIds = [...new Set(allocationIds)];
  const { data, error } = await supabase.rpc('search_allocation_ids_by_note_body', {
    p_agency_id: agencyId,
    p_allocation_ids: uniqueIds,
    p_query: q,
  });

  if (error) throw error;
  return new Set((data ?? []) as string[]);
}
