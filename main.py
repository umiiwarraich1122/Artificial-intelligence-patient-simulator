"""
Main entry point for FastAPI backend application (used by Vercel and local Uvicorn).
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from clinic_backend.config import BASE_DIR
from clinic_backend.llm.client import initialize as init_llm_client
from clinic_backend.patients import router as patients_router
from clinic_backend.chat import router as chat_router
from clinic_backend.routers import misc as misc_router

app = FastAPI(
    title="AI Patient Simulator Backend",
    description="Project-based Modular API backend for AI Patient Simulator.",
    version="3.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup logic
@app.on_event("startup")
async def startup_event():
    try:
        print("[Startup] Initializing LLM Provider Client...")
        client = init_llm_client()
        if client:
            print("[Startup] Client configured successfully.")
        else:
            print("[Startup] ⚠ Warning: LLM API key not found in environment!")
    except Exception as e:
        print(f"[Startup] Error during initialization: {e}")


# Mount static reports directory
app.mount("/static", StaticFiles(directory=str(BASE_DIR)), name="static")

# Include Routers
app.include_router(misc_router.router)
app.include_router(patients_router)
app.include_router(chat_router)
