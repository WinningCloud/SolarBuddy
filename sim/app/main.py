from fastapi import FastAPI

from app.settings import DATA_DIR

app = FastAPI(
    title="SecondSun sim",
    version="0.1.0",
    description="Deterministic PV models, triage and economics. Every number shown in the UI comes from here.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "data_dir": str(DATA_DIR)}
