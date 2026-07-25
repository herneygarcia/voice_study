from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import generation, lectures, pages, recording

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Voice Study")

init_db()

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount(
    "/media", StaticFiles(directory=str(BASE_DIR / "app" / "static_media")), name="media"
)

app.include_router(pages.router)
app.include_router(lectures.router)
app.include_router(recording.router)
app.include_router(generation.router)
