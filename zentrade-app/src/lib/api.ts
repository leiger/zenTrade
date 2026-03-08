import type { Thesis, Snapshot, FollowUp, ThesisTag, Verdict } from '@/types/thesis';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  console.log('[API] Request:', url, init?.method || 'GET');
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  console.log('[API] Response:', res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] Error response:', text);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  console.log('[API] Response data:', data);
  return data;
}

// ── snake_case → camelCase mappers ──────────────────

function mapTag(raw: Record<string, string>): ThesisTag {
  return { id: raw.id, label: raw.label, category: raw.category as ThesisTag['category'] };
}

function mapFollowUp(raw: Record<string, string> | null): FollowUp | undefined {
  if (!raw) return undefined;
  return {
    id: raw.id,
    snapshotId: raw.snapshot_id,
    comment: raw.comment,
    verdict: raw.verdict as Verdict,
    createdAt: raw.created_at,
  };
}

function mapSnapshot(raw: Record<string, unknown>): Snapshot {
  return {
    id: raw.id as string,
    thesisId: raw.thesis_id as string,
    content: raw.content as string,
    aiAnalysis: (raw.ai_analysis as string) || '',
    tags: ((raw.tags as Record<string, string>[]) || []).map(mapTag),
    timeline: raw.timeline as Snapshot['timeline'],
    expectedReviewDate: raw.expected_review_date as string,
    createdAt: raw.created_at as string,
    updatedAt: (raw.updated_at as string) || '',
    links: (raw.links as string[]) || [],
    influencedBy: (raw.influenced_by as string) || '',
    followUp: mapFollowUp(raw.follow_up as Record<string, string> | null),
  };
}

function mapThesis(raw: Record<string, unknown>): Thesis {
  return {
    id: raw.id as string,
    name: raw.name as string,
    category: raw.category as Thesis['category'],
    asset: raw.asset as string,
    description: raw.description as string,
    tags: ((raw.tags as Record<string, string>[]) || []).map(mapTag),
    snapshots: ((raw.snapshots as Record<string, unknown>[]) || []).map(mapSnapshot),
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

// ── API functions ───────────────────────────────────

export async function fetchTheses(): Promise<Thesis[]> {
  const raw = await request<Record<string, unknown>[]>('/theses');
  return raw.map(mapThesis);
}

export async function fetchThesis(id: string): Promise<Thesis> {
  const raw = await request<Record<string, unknown>>(`/theses/${id}`);
  return mapThesis(raw);
}

export async function createThesis(data: { name: string; category: string; asset: string }): Promise<Thesis> {
  const raw = await request<Record<string, unknown>>('/theses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return mapThesis(raw);
}

export async function updateThesis(
  id: string,
  updates: { name?: string; description?: string; tags?: string[] }
): Promise<Thesis> {
  const raw = await request<Record<string, unknown>>(`/theses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return mapThesis(raw);
}

export async function deleteThesis(id: string): Promise<void> {
  await request<void>(`/theses/${id}`, { method: 'DELETE' });
}

export async function reorderTheses(orderedIds: string[]): Promise<Thesis[]> {
  const raw = await request<Record<string, unknown>[]>('/theses/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  return raw.map(mapThesis);
}

export async function createSnapshot(
  thesisId: string,
  data: {
    content: string;
    aiAnalysis: string;
    tags: string[];
    timeline: string;
    expectedReviewDate: string;
    links: string[];
    influencedBy: string;
  }
): Promise<Snapshot> {
  const raw = await request<Record<string, unknown>>(`/theses/${thesisId}/snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      content: data.content,
      ai_analysis: data.aiAnalysis,
      tags: data.tags,
      timeline: data.timeline,
      expected_review_date: data.expectedReviewDate,
      links: data.links,
      influenced_by: data.influencedBy,
    }),
  });
  return mapSnapshot(raw);
}

export async function updateSnapshot(
  thesisId: string,
  snapshotId: string,
  data: {
    content?: string;
    aiAnalysis?: string;
    tags?: string[];
    timeline?: string;
    expectedReviewDate?: string;
    links?: string[];
    influencedBy?: string;
  }
): Promise<Snapshot> {
  const payload: Record<string, unknown> = {};
  if (data.content !== undefined) payload.content = data.content;
  if (data.aiAnalysis !== undefined) payload.ai_analysis = data.aiAnalysis;
  if (data.tags !== undefined) payload.tags = data.tags;
  if (data.timeline !== undefined) payload.timeline = data.timeline;
  if (data.expectedReviewDate !== undefined) payload.expected_review_date = data.expectedReviewDate;
  if (data.links !== undefined) payload.links = data.links;
  if (data.influencedBy !== undefined) payload.influenced_by = data.influencedBy;

  const raw = await request<Record<string, unknown>>(
    `/theses/${thesisId}/snapshots/${snapshotId}`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  );
  return mapSnapshot(raw);
}

export async function deleteSnapshot(thesisId: string, snapshotId: string): Promise<void> {
  await request<void>(`/theses/${thesisId}/snapshots/${snapshotId}`, { method: 'DELETE' });
}

// ── Tags ────────────────────────────────────────────

export async function fetchTags(): Promise<ThesisTag[]> {
  const raw = await request<Record<string, string>[]>('/tags');
  return raw.map(mapTag);
}

export async function createTag(data: { label: string; category: string }): Promise<ThesisTag> {
  const raw = await request<Record<string, string>>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return mapTag(raw);
}

export async function deleteTag(tagId: string): Promise<void> {
  await request<void>(`/tags/${tagId}`, { method: 'DELETE' });
}

export async function upsertFollowUp(
  thesisId: string,
  snapshotId: string,
  data: { comment: string; verdict: string }
): Promise<FollowUp> {
  const raw = await request<Record<string, string>>(
    `/theses/${thesisId}/snapshots/${snapshotId}/follow-up`,
    { method: 'PUT', body: JSON.stringify(data) }
  );
  return mapFollowUp(raw)!;
}
