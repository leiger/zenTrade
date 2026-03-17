import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import models

from app.database import init_db
from app.seed import seed_data
from app.routers import theses, snapshots, follow_ups, accounts, assets, holdings, adjustments, market_data
from app.xmonitor.database import init_xmonitor_db
from app.xmonitor.router import router as xmonitor_router
from app.xmonitor.poller import poller as xmonitor_poller

_cors_origins_env = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_data()
    await init_xmonitor_db()
    xmonitor_poller.start()
    yield
    await xmonitor_poller.stop()


app = FastAPI(title="ZenTrade Thesis Tracker API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(theses.router, prefix="/api")
app.include_router(snapshots.router, prefix="/api")
app.include_router(follow_ups.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(holdings.router, prefix="/api")
app.include_router(adjustments.router, prefix="/api")
app.include_router(market_data.router, prefix="/api")
app.include_router(xmonitor_router, prefix="/api")


@app.get("/api/tags")
async def list_tags():
    from app.database import get_db, fetchall
    db = await get_db()
    try:
        rows = await fetchall(db, "SELECT * FROM tags ORDER BY category, id")
        return [{"id": r["id"], "label": r["label"], "category": r["category"]} for r in rows]
    finally:
        await db.close()


@app.post("/api/tags", status_code=201)
async def create_tag(body: models.TagCreate):
    import uuid
    from app.database import get_db, fetchall
    db = await get_db()
    try:
        tag_id = f"{body.category}-{uuid.uuid4().hex[:8]}"
        await db.execute(
            "INSERT INTO tags (id, label, category) VALUES (?, ?, ?)",
            (tag_id, body.label.strip(), body.category),
        )
        await db.commit()
        return {"id": tag_id, "label": body.label.strip(), "category": body.category}
    finally:
        await db.close()


@app.delete("/api/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: str):
    from app.database import get_db, fetchall
    db = await get_db()
    try:
        rows = await fetchall(db, "SELECT id FROM tags WHERE id = ?", (tag_id,))
        if not rows:
            raise HTTPException(404, "Tag not found")
        await db.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
        await db.commit()
    finally:
        await db.close()


@app.get("/health")
async def health():
    return {"status": "ok"}
