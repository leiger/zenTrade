import os
import re
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException

from app.database import fetchall, get_db
from app.models import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthRegisterRequest,
    AuthRegisterResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_JWT_SECRET = os.getenv("AUTH_JWT_SECRET", "")
_JWT_EXPIRES_DAYS = int(os.getenv("AUTH_JWT_EXPIRES_DAYS", "7"))
_JWT_ALG = "HS256"

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
_MIN_PASSWORD_LEN = 8


def _require_jwt_secret() -> None:
    if not _JWT_SECRET or len(_JWT_SECRET) < 32:
        raise HTTPException(
            status_code=500,
            detail="Server auth is not configured (set AUTH_JWT_SECRET, min 32 chars)",
        )


def _issue_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=_JWT_EXPIRES_DAYS)
    token = jwt.encode(
        {"sub": username, "iat": int(now.timestamp()), "exp": exp},
        _JWT_SECRET,
        algorithm=_JWT_ALG,
    )
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def _validate_username(username: str) -> str:
    username = username.strip()
    if not _USERNAME_RE.match(username):
        raise HTTPException(
            status_code=422,
            detail="Username must be 3-32 characters (letters, numbers, underscore only)",
        )
    return username


def _validate_password(password: str) -> None:
    if len(password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"Password must be at least {_MIN_PASSWORD_LEN} characters",
        )
    if not re.search(r"[a-zA-Z]", password):
        raise HTTPException(status_code=422, detail="Password must contain at least one letter")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=422, detail="Password must contain at least one number")


@router.post("/register", response_model=AuthRegisterResponse)
async def register(body: AuthRegisterRequest) -> AuthRegisterResponse:
    _require_jwt_secret()

    username = _validate_username(body.username)
    _validate_password(body.password)

    db = await get_db()
    try:
        existing = await fetchall(
            db, "SELECT id FROM auth_users WHERE username = ?", (username,)
        )
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")

        user_id = f"user-{uuid.uuid4().hex[:12]}"
        pwd_hash = bcrypt.hashpw(
            body.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")
        now = datetime.now(timezone.utc).isoformat()

        await db.execute(
            "INSERT INTO auth_users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, pwd_hash, now),
        )
        await db.commit()
    finally:
        await db.close()

    return AuthRegisterResponse(token=_issue_token(username))


@router.post("/login", response_model=AuthLoginResponse)
async def login(body: AuthLoginRequest) -> AuthLoginResponse:
    _require_jwt_secret()

    username = body.username.strip()
    if not username or not body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    db = await get_db()
    try:
        rows = await fetchall(
            db,
            "SELECT password_hash FROM auth_users WHERE username = ?",
            (username,),
        )
        if not rows:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        stored = rows[0]["password_hash"]
        if isinstance(stored, bytes):
            stored = stored.decode("utf-8")
        ok = bcrypt.checkpw(
            body.password.encode("utf-8"),
            stored.encode("utf-8"),
        )
        if not ok:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    finally:
        await db.close()

    return AuthLoginResponse(token=_issue_token(username))
