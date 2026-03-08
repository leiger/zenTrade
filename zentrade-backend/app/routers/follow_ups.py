from __future__ import annotations

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.database import get_db, fetchall
from app.models import FollowUp, FollowUpCreate

router = APIRouter(
    prefix="/theses/{thesis_id}/snapshots/{snapshot_id}/follow-up",
    tags=["follow-ups"],
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _assert_snapshot_exists(db, thesis_id: str, snapshot_id: str):
    rows = await fetchall(db,
        "SELECT id FROM snapshots WHERE id = ? AND thesis_id = ?", (snapshot_id, thesis_id)
    )
    if not rows:
        raise HTTPException(404, "Snapshot not found")


# ── CREATE / REPLACE ─────────────────────────────────

@router.put("", response_model=FollowUp)
async def upsert_follow_up(thesis_id: str, snapshot_id: str, body: FollowUpCreate):
    db = await get_db()
    try:
        await _assert_snapshot_exists(db, thesis_id, snapshot_id)

        existing = await fetchall(db,
            "SELECT id FROM follow_ups WHERE snapshot_id = ?", (snapshot_id,)
        )

        now = _now_iso()
        if existing:
            fid = existing[0]["id"]
            await db.execute(
                "UPDATE follow_ups SET comment = ?, verdict = ?, created_at = ? WHERE id = ?",
                (body.comment, body.verdict, now, fid),
            )
        else:
            fid = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO follow_ups (id, snapshot_id, comment, verdict, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (fid, snapshot_id, body.comment, body.verdict, now),
            )

        await db.execute("UPDATE theses SET updated_at = ? WHERE id = ?", (now, thesis_id))
        await db.commit()

        return FollowUp(
            id=fid, snapshot_id=snapshot_id,
            comment=body.comment, verdict=body.verdict, created_at=now,
        )
    finally:
        await db.close()


# ── DELETE ───────────────────────────────────────────

@router.delete("", status_code=204)
async def delete_follow_up(thesis_id: str, snapshot_id: str):
    db = await get_db()
    try:
        await _assert_snapshot_exists(db, thesis_id, snapshot_id)
        rows = await fetchall(db,
            "SELECT id FROM follow_ups WHERE snapshot_id = ?", (snapshot_id,)
        )
        if not rows:
            raise HTTPException(404, "FollowUp not found")
        await db.execute("DELETE FROM follow_ups WHERE snapshot_id = ?", (snapshot_id,))
        await db.execute("UPDATE theses SET updated_at = ? WHERE id = ?", (_now_iso(), thesis_id))
        await db.commit()
    finally:
        await db.close()
