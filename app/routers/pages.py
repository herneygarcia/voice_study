from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import SUPPORTED_LANGUAGES

router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent.parent / "templates"))


@router.get("/")
def dashboard(request: Request):
    return templates.TemplateResponse(request, "index.html", {})


@router.get("/record")
def record_page(request: Request):
    return templates.TemplateResponse(request, "record.html", {"languages": SUPPORTED_LANGUAGES})


@router.get("/lectures/{lecture_id}")
def lecture_detail_page(request: Request, lecture_id: int):
    return templates.TemplateResponse(request, "lecture_detail.html", {"lecture_id": lecture_id})
