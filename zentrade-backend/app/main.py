from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.seed import seed_data
from app.routers import theses, snapshots, follow_ups


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_data()
    yield


app = FastAPI(title="ZenTrade Thesis Tracker API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(theses.router, prefix="/api")
app.include_router(snapshots.router, prefix="/api")
app.include_router(follow_ups.router, prefix="/api")


@app.get("/api/tags")
async def list_tags():
    from app.database import get_db, fetchall
    db = await get_db()
    try:
        rows = await fetchall(db, "SELECT * FROM tags ORDER BY category, id")
        return [{"id": r["id"], "label": r["label"], "category": r["category"]} for r in rows]
    finally:
        await db.close()


@app.get("/health")
async def health():
    return {"status": "ok"}
