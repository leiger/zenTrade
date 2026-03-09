from __future__ import annotations

import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db, fetchall
from app.models import (
    Thesis, ThesisCreate, ThesisUpdate, ThesisReorder,
    Tag, Snapshot, FollowUp,
)

router = APIRouter(prefix="/theses", tags=["theses"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_influenced_by(val: str) -> list[str]:
    if not val:
        return []
    try:
        parsed = json.loads(val)
        if isinstance(parsed, list):
            return [str(v) for v in parsed]
        return [str(parsed)]
    except Exception:
        return [v.strip() for v in val.split(",") if v.strip()]


async def _load_thesis_tags(db, thesis_id: str) -> list[Tag]:
    rows = await fetchall(db,
        "SELECT t.id, t.label, t.category FROM tags t "
        "JOIN thesis_tags tt ON t.id = tt.tag_id WHERE tt.thesis_id = ?",
        (thesis_id,),
    )
    return [Tag(id=r["id"], label=r["label"], category=r["category"]) for r in rows]


async def _load_snapshot_tags(db, snapshot_id: str) -> list[Tag]:
    rows = await fetchall(db,
        "SELECT t.id, t.label, t.category FROM tags t "
        "JOIN snapshot_tags st ON t.id = st.tag_id WHERE st.snapshot_id = ?",
        (snapshot_id,),
    )
    return [Tag(id=r["id"], label=r["label"], category=r["category"]) for r in rows]


async def _load_snapshot_links(db, snapshot_id: str) -> list[str]:
    rows = await fetchall(db,
        "SELECT url FROM snapshot_links WHERE snapshot_id = ?", (snapshot_id,)
    )
    return [r["url"] for r in rows]


async def _load_follow_up(db, snapshot_id: str) -> FollowUp | None:
    row = await fetchall(db,
        "SELECT * FROM follow_ups WHERE snapshot_id = ?", (snapshot_id,)
    )
    if not row:
        return None
    r = row[0]
    return FollowUp(
        id=r["id"], snapshot_id=r["snapshot_id"],
        comment=r["comment"], verdict=r["verdict"], created_at=r["created_at"],
    )


async def _load_snapshots(db, thesis_id: str) -> list[Snapshot]:
    rows = await fetchall(db,
        "SELECT * FROM snapshots WHERE thesis_id = ? ORDER BY created_at", (thesis_id,)
    )
    result = []
    for r in rows:
        sid = r["id"]
        result.append(Snapshot(
            id=sid, thesis_id=r["thesis_id"], content=r["content"],
            ai_analysis=r["ai_analysis"],
            tags=await _load_snapshot_tags(db, sid),
            timeline=r["timeline"],
            expected_review_date=r["expected_review_date"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            links=await _load_snapshot_links(db, sid),
            influenced_by=_parse_influenced_by(r["influenced_by"]),
            follow_up=await _load_follow_up(db, sid),
        ))
    return result


async def _build_thesis(db, row) -> Thesis:
    tid = row["id"]
    return Thesis(
        id=tid, name=row["name"], category=row["category"],
        asset=row["asset"], status=row["status"] or "active", description=row["description"],
        tags=await _load_thesis_tags(db, tid),
        snapshots=await _load_snapshots(db, tid),
        created_at=row["created_at"], updated_at=row["updated_at"],
    )


# ── LIST ─────────────────────────────────────────────

@router.get("", response_model=list[Thesis])
async def list_theses():
    db = await get_db()
    try:
        rows = await fetchall(db,"SELECT * FROM theses ORDER BY sort_order, created_at DESC")
        return [await _build_thesis(db, r) for r in rows]
    finally:
        await db.close()


# ── GET ──────────────────────────────────────────────

@router.get("/{thesis_id}", response_model=Thesis)
async def get_thesis(thesis_id: str):
    db = await get_db()
    try:
        rows = await fetchall(db,"SELECT * FROM theses WHERE id = ?", (thesis_id,))
        if not rows:
            raise HTTPException(404, "Thesis not found")
        return await _build_thesis(db, rows[0])
    finally:
        await db.close()


# ── CREATE ───────────────────────────────────────────

@router.post("", response_model=Thesis, status_code=201)
async def create_thesis(body: ThesisCreate):
    db = await get_db()
    try:
        tid = str(uuid.uuid4())
        now = _now_iso()
        max_order = await fetchall(db, "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM theses")
        order = max_order[0]["next_order"]
        await db.execute(
            "INSERT INTO theses (id, name, category, asset, status, description, sort_order, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)",
            (tid, body.name, body.category, body.asset, body.status, order, now, now),
        )
        await db.commit()
        rows = await fetchall(db,"SELECT * FROM theses WHERE id = ?", (tid,))
        return await _build_thesis(db, rows[0])
    finally:
        await db.close()


# ── UPDATE ───────────────────────────────────────────

@router.patch("/{thesis_id}", response_model=Thesis)
async def update_thesis(thesis_id: str, body: ThesisUpdate):
    db = await get_db()
    try:
        rows = await fetchall(db,"SELECT * FROM theses WHERE id = ?", (thesis_id,))
        if not rows:
            raise HTTPException(404, "Thesis not found")

        sets, params = [], []
        if body.name is not None:
            sets.append("name = ?")
            params.append(body.name)
        if body.description is not None:
            sets.append("description = ?")
            params.append(body.description)
        if body.status is not None:
            sets.append("status = ?")
            params.append(body.status)

        now = _now_iso()
        sets.append("updated_at = ?")
        params.append(now)
        params.append(thesis_id)

        if sets:
            await db.execute(f"UPDATE theses SET {', '.join(sets)} WHERE id = ?", params)

        if body.tags is not None:
            await db.execute("DELETE FROM thesis_tags WHERE thesis_id = ?", (thesis_id,))
            for tag_id in body.tags:
                await db.execute(
                    "INSERT OR IGNORE INTO thesis_tags (thesis_id, tag_id) VALUES (?, ?)",
                    (thesis_id, tag_id),
                )

        await db.commit()
        rows = await fetchall(db,"SELECT * FROM theses WHERE id = ?", (thesis_id,))
        return await _build_thesis(db, rows[0])
    finally:
        await db.close()


# ── DELETE ───────────────────────────────────────────

@router.delete("/{thesis_id}", status_code=204)
async def delete_thesis(thesis_id: str):
    db = await get_db()
    try:
        rows = await fetchall(db,"SELECT id FROM theses WHERE id = ?", (thesis_id,))
        if not rows:
            raise HTTPException(404, "Thesis not found")
        await db.execute("DELETE FROM theses WHERE id = ?", (thesis_id,))
        await db.commit()
    finally:
        await db.close()


# ── REORDER ──────────────────────────────────────────

@router.put("/reorder", response_model=list[Thesis])
async def reorder_theses(body: ThesisReorder):
    db = await get_db()
    try:
        for idx, tid in enumerate(body.ordered_ids):
            await db.execute("UPDATE theses SET sort_order = ? WHERE id = ?", (idx, tid))
        await db.commit()
        rows = await fetchall(db,"SELECT * FROM theses ORDER BY sort_order")
        return [await _build_thesis(db, r) for r in rows]
    finally:
        await db.close()
