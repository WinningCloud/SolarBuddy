import os
from pathlib import Path

SIM_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", SIM_ROOT.parent / "data")).resolve()
