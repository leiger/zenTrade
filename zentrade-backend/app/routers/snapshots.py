from __future__ import annotations

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db, fetchall
from app.models import Snapshot, SnapshotCreate, SnapshotUpdate, Tag, FollowUp

router = APIRouter(prefix="/theses/{thesis_id}/snapshots", tags=["snapshots"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    rows = await fetchall(db,
        "SELECT * FROM follow_ups WHERE snapshot_id = ?", (snapshot_id,)
    )
    if not rows:
        return None
    r = rows[0]
    return FollowUp(
        id=r["id"], snapshot_id=r["snapshot_id"],
        comment=r["comment"], verdict=r["verdict"], created_at=r["created_at"],
    )


async def _build_snapshot(db, r) -> Snapshot:
    sid = r["id"]
    return Snapshot(
        id=sid, thesis_id=r["thesis_id"], content=r["content"],
        ai_analysis=r["ai_analysis"],
        tags=await _load_snapshot_tags(db, sid),
        timeline=r["timeline"],
        expected_review_date=r["expected_review_date"],
        created_at=r["created_at"],
        updated_at=r["updated_at"] or "",
        links=await _load_snapshot_links(db, sid),
        influenced_by=r["influenced_by"],
        follow_up=await _load_follow_up(db, sid),
    )


async def _assert_thesis_exists(db, thesis_id: str):
    rows = await fetchall(db,"SELECT id FROM theses WHERE id = ?", (thesis_id,))
    if not rows:
        raise HTTPException(404, "Thesis not found")


# ── LIST ─────────────────────────────────────────────

@router.get("", response_model=list[Snapshot])
async def list_snapshots(thesis_id: str):
    db = await get_db()
    try:
        await _assert_thesis_exists(db, thesis_id)
        rows = await fetchall(db,
            "SELECT * FROM snapshots WHERE thesis_id = ? ORDER BY created_at", (thesis_id,)
        )
        return [await _build_snapshot(db, r) for r in rows]
    finally:
        await db.close()


# ── CREATE ───────────────────────────────────────────

@router.post("", response_model=Snapshot, status_code=201)
async def create_snapshot(thesis_id: str, body: SnapshotCreate):
    db = await get_db()
    try:
        await _assert_thesis_exists(db, thesis_id)
        sid = str(uuid.uuid4())
        now = _now_iso()

        await db.execute(
            "INSERT INTO snapshots (id, thesis_id, content, ai_analysis, timeline, expected_review_date, influenced_by, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, thesis_id, body.content, body.ai_analysis, body.timeline, body.expected_review_date, body.influenced_by, now, now),
        )

        for tag_id in body.tags:
            await db.execute(
                "INSERT OR IGNORE INTO snapshot_tags (snapshot_id, tag_id) VALUES (?, ?)",
                (sid, tag_id),
            )

        for url in body.links:
            await db.execute(
                "INSERT INTO snapshot_links (snapshot_id, url) VALUES (?, ?)",
                (sid, url),
            )

        await db.execute("UPDATE theses SET updated_at = ? WHERE id = ?", (now, thesis_id))
        await db.commit()

        rows = await fetchall(db,"SELECT * FROM snapshots WHERE id = ?", (sid,))
        return await _build_snapshot(db, rows[0])
    finally:
        await db.close()


# ── UPDATE ───────────────────────────────────────────

@router.patch("/{snapshot_id}", response_model=Snapshot)
async def update_snapshot(thesis_id: str, snapshot_id: str, body: SnapshotUpdate):
    db = await get_db()
    try:
        rows = await fetchall(db,
            "SELECT id FROM snapshots WHERE id = ? AND thesis_id = ?", (snapshot_id, thesis_id)
        )
        if not rows:
            raise HTTPException(404, "Snapshot not found")

        now = _now_iso()
        sets: list[str] = ["updated_at = ?"]
        params: list[str] = [now]

        if body.content is not None:
            sets.append("content = ?")
            params.append(body.content)
        if body.ai_analysis is not None:
            sets.append("ai_analysis = ?")
            params.append(body.ai_analysis)
        if body.influenced_by is not None:
            sets.append("influenced_by = ?")
            params.append(body.influenced_by)
        if body.timeline is not None:
            sets.append("timeline = ?")
            params.append(body.timeline)
        if body.expected_review_date is not None:
            sets.append("expected_review_date = ?")
            params.append(body.expected_review_date)

        params.append(snapshot_id)
        await db.execute(f"UPDATE snapshots SET {', '.join(sets)} WHERE id = ?", tuple(params))

        if body.tags is not None:
            await db.execute("DELETE FROM snapshot_tags WHERE snapshot_id = ?", (snapshot_id,))
            for tag_id in body.tags:
                await db.execute(
                    "INSERT OR IGNORE INTO snapshot_tags (snapshot_id, tag_id) VALUES (?, ?)",
                    (snapshot_id, tag_id),
                )

        if body.links is not None:
            await db.execute("DELETE FROM snapshot_links WHERE snapshot_id = ?", (snapshot_id,))
            for url in body.links:
                await db.execute(
                    "INSERT INTO snapshot_links (snapshot_id, url) VALUES (?, ?)",
                    (snapshot_id, url),
                )

        await db.execute("UPDATE theses SET updated_at = ? WHERE id = ?", (now, thesis_id))
        await db.commit()

        row = await fetchall(db, "SELECT * FROM snapshots WHERE id = ?", (snapshot_id,))
        return await _build_snapshot(db, row[0])
    finally:
        await db.close()


# ── DELETE ───────────────────────────────────────────

@router.delete("/{snapshot_id}", status_code=204)
async def delete_snapshot(thesis_id: str, snapshot_id: str):
    db = await get_db()
    try:
        rows = await fetchall(db,
            "SELECT id FROM snapshots WHERE id = ? AND thesis_id = ?", (snapshot_id, thesis_id)
        )
        if not rows:
            raise HTTPException(404, "Snapshot not found")
        await db.execute("DELETE FROM snapshots WHERE id = ?", (snapshot_id,))
        await db.execute("UPDATE theses SET updated_at = ? WHERE id = ?", (_now_iso(), thesis_id))
        await db.commit()
    finally:
        await db.close()
