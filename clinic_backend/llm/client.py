"""
LLM client factory — creates the appropriate OpenAI-compatible client
based on the API key prefix (Groq, Cerebras, or standard OpenAI).
"""
import os
from pathlib import Path
from typing import Optional, List, Tuple
from openai import OpenAI
from clinic_backend.config import BASE_DIR


def _read_api_key_direct() -> str:
    """
    Read the API key directly from .env to bypass IDE-injected environment
    variable pollution (e.g. Cursor injects its own OPENAI_API_KEY).
    """
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return ""
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("GROQ_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
            if line.startswith("CEREBRAS_API_KEY=") or line.startswith("CSK_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
            if line.startswith("OPENAI_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    return val
    return ""


def get_api_key() -> str:
    """Return the active API key from the environment."""
    return (
        os.getenv("GROQ_API_KEY")
        or os.getenv("CEREBRAS_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or ""
    )


def build_client(api_key: Optional[str] = None) -> Optional[OpenAI]:
    """Build and return an OpenAI-compatible client for the given key."""
    try:
        key = api_key or get_api_key()
        if not key:
            return None
        if key.startswith("gsk_"):
            return OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
        if key.startswith("csk-"):
            return OpenAI(api_key=key, base_url="https://api.cerebras.ai/v1")
        return OpenAI(api_key=key)
    except Exception as e:
        print(f"[LLM Client] Error building client: {e}")
        return None


def get_model_name(api_key: Optional[str] = None) -> str:
    """Return the default model ID for the active provider."""
    key = api_key or get_api_key()
    if key.startswith("gsk_"):
        return "llama-3.3-70b-versatile"
    if key.startswith("csk-"):
        return "gpt-oss-120b"
    return "gpt-4o-mini"


def build_client_direct() -> Tuple[Optional[OpenAI], List[str]]:
    """
    Build a client by reading the API key directly from .env.
    Returns (client, list_of_models_to_try).
    Used by patient generation to avoid env pollution.
    """
    try:
        key = _read_api_key_direct()
        if not key:
            return None, ["gpt-4o-mini"]
        if key.startswith("gsk_"):
            client = OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
            models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
        elif key.startswith("csk-"):
            client = OpenAI(api_key=key, base_url="https://api.cerebras.ai/v1")
            models = ["gpt-oss-120b", "gemma-4-31b", "zai-glm-4.7"]
        else:
            client = OpenAI(api_key=key)
            models = ["gpt-4o-mini", "gpt-4o"]
        return client, models
    except Exception as e:
        print(f"[LLM Client] Error building client direct: {e}")
        return None, ["gpt-4o-mini"]


# Module-level singleton — initialised at startup
_client: Optional[OpenAI] = None


def get_client() -> Optional[OpenAI]:
    return _client


def initialize() -> Optional[OpenAI]:
    global _client
    _client = build_client()
    return _client
