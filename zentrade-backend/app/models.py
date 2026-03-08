from pydantic import BaseModel
from typing import Literal, Optional


# ── Tag ──────────────────────────────────────────────

TagCategory = Literal["buy", "sell"]


class Tag(BaseModel):
    id: str
    label: str
    category: TagCategory


# ── FollowUp ─────────────────────────────────────────

Verdict = Literal["correct", "wrong", "neutral"]


class FollowUpCreate(BaseModel):
    comment: str
    verdict: Verdict


class FollowUp(BaseModel):
    id: str
    snapshot_id: str
    comment: str
    verdict: Verdict
    created_at: str


# ── Snapshot ─────────────────────────────────────────

TimelineOption = Literal["1D", "1W", "1M", "1Q"]


class SnapshotCreate(BaseModel):
    content: str
    tags: list[str]  # tag ids
    timeline: TimelineOption
    expected_review_date: str
    links: list[str] = []
    influenced_by: str = ""


class Snapshot(BaseModel):
    id: str
    thesis_id: str
    content: str
    tags: list[Tag] = []
    timeline: TimelineOption
    expected_review_date: str
    created_at: str
    links: list[str] = []
    influenced_by: str = ""
    follow_up: Optional[FollowUp] = None


# ── Thesis ───────────────────────────────────────────

AssetCategory = Literal["crypto", "us-stock", "a-stock", "hk-stock", "bond", "commodity"]


class ThesisCreate(BaseModel):
    name: str
    category: AssetCategory
    asset: str = ""


class ThesisUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None  # tag ids


class ThesisReorder(BaseModel):
    ordered_ids: list[str]


class Thesis(BaseModel):
    id: str
    name: str
    category: AssetCategory
    asset: str
    description: str
    tags: list[Tag] = []
    snapshots: list[Snapshot] = []
    created_at: str
    updated_at: str
