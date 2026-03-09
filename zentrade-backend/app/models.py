from pydantic import BaseModel
from typing import Literal, Optional


# ── Tag ──────────────────────────────────────────────

TagCategory = Literal["buy", "sell"]


class Tag(BaseModel):
    id: str
    label: str
    category: TagCategory


class TagCreate(BaseModel):
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

TimelineOption = Literal["1D", "1W", "1M", "1Q", "custom"]


class SnapshotCreate(BaseModel):
    content: str
    ai_analysis: str = ""
    tags: list[str]  # tag ids
    timeline: TimelineOption
    expected_review_date: str
    links: list[str] = []
    influenced_by: list[str] = []


class SnapshotUpdate(BaseModel):
    content: Optional[str] = None
    ai_analysis: Optional[str] = None
    tags: Optional[list[str]] = None
    timeline: Optional[TimelineOption] = None
    expected_review_date: Optional[str] = None
    links: Optional[list[str]] = None
    influenced_by: Optional[list[str]] = None


class Snapshot(BaseModel):
    id: str
    thesis_id: str
    content: str
    ai_analysis: str = ""
    tags: list[Tag] = []
    timeline: TimelineOption
    expected_review_date: str
    created_at: str
    updated_at: str = ""
    links: list[str] = []
    influenced_by: list[str] = []
    follow_up: Optional[FollowUp] = None


# ── Thesis ───────────────────────────────────────────

AssetCategory = Literal["crypto", "us-stock", "a-stock", "hk-stock", "bond", "commodity"]
ThesisStatus = Literal["active", "paused", "archived", "invalidated"]


class ThesisCreate(BaseModel):
    name: str
    category: AssetCategory
    asset: str = ""
    status: ThesisStatus = "active"


class ThesisUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None  # tag ids
    status: Optional[ThesisStatus] = None


class ThesisReorder(BaseModel):
    ordered_ids: list[str]


class Thesis(BaseModel):
    id: str
    name: str
    category: AssetCategory
    asset: str
    status: ThesisStatus = "active"
    description: str
    tags: list[Tag] = []
    snapshots: list[Snapshot] = []
    created_at: str
    updated_at: str
