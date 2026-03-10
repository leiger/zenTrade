from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.database import get_db, fetchall
from app.models import Account, AccountCreate
from app.portfolio_utils import list_accounts, now_iso


router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[Account])
async def get_accounts():
    db = await get_db()
    try:
        return await list_accounts(db)
    finally:
        await db.close()


@router.post("", response_model=Account, status_code=201)
async def create_account(body: AccountCreate):
    db = await get_db()
    try:
        timestamp = now_iso()
        account_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO accounts (id, name, type, broker_or_platform, base_currency, notes, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                account_id,
                body.name.strip(),
                body.type,
                body.broker_or_platform.strip(),
                body.base_currency.strip().upper() or "USD",
                body.notes.strip(),
                timestamp,
                timestamp,
            ),
        )
        await db.commit()
        rows = await fetchall(db, "SELECT * FROM accounts WHERE id = ?", (account_id,))
        if not rows:
            raise HTTPException(500, "Failed to create account")
        row = rows[0]
        return Account(
            id=row["id"],
            name=row["name"],
            type=row["type"],
            broker_or_platform=row["broker_or_platform"],
            base_currency=row["base_currency"],
            notes=row["notes"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
    finally:
        await db.close()
