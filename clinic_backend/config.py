"""
Configuration — loads .env and exposes settings used across the whole app.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Always load from the project .env first so that any IDE-injected env vars
# (e.g. Cursor injects its own OPENAI_API_KEY) are overridden by ours.
load_dotenv(BASE_DIR / ".env", override=True)

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠  Warning: SUPABASE_URL or SUPABASE_KEY is missing — check your .env file.")

MAX_MESSAGE_LENGTH = 2000

REPORTS_DIR = BASE_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
