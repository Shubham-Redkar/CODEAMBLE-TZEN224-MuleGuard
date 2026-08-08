from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes_health import router as health_router
from app.api.routes_upload import router as upload_router
from app.api.routes_review import router as review_router
from app.api.routes_analysis import router as analysis_router
from app.api.routes_graph import router as graph_router
from app.api.routes_report import router as report_router
from app.api.routes_config import router as config_router
from app.db.session import engine
from app.db.models import SQLModel
from app.guardrails.privacy_guard import PIIRedactionMiddleware

app = FastAPI(
    title="MuleGuard Local",
    description="Fully offline, explainable, formula-driven Mule-Account Detection System",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)


@app.on_event("startup")
async def on_startup():
    SQLModel.metadata.create_all(engine)

app.add_middleware(PIIRedactionMiddleware)


app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(upload_router, prefix="/api/statements", tags=["upload"])
app.include_router(review_router, prefix="/api/statements", tags=["review"])
app.include_router(analysis_router, prefix="/api/statements", tags=["analysis"])
app.include_router(graph_router, prefix="/api/statements", tags=["graph"])
app.include_router(report_router, prefix="/api/statements", tags=["report"])
app.include_router(config_router, prefix="/api/config", tags=["config"])


static_dir = Path(__file__).parents[2] / "frontend" / "dist"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
