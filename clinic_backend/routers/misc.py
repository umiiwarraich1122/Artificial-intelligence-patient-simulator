"""
Miscellaneous endpoints — provider check, generate report, status, auth.
"""
from fastapi import APIRouter, Depends, HTTPException
from clinic_backend.auth import get_bearer_token, get_current_supabase_user
from clinic_backend.schemas import GenerateReportRequest
from clinic_backend.tools.definitions import export_consultation_report_impl
from clinic_backend.llm.client import get_api_key

router = APIRouter()


@router.get("/")
async def read_root():
    return {"message": "AI Patient Simulator Backend"}


@router.get("/status")
async def get_status():
    return {"status": "ok"}


@router.get("/auth/check-provider")
async def check_provider():
    """Return the currently configured LLM provider based on env."""
    api_key = get_api_key()
    if not api_key:
        return {"provider": "none"}
    if api_key.startswith("gsk_"):
        return {"provider": "groq"}
    if api_key.startswith("csk-"):
        return {"provider": "cerebras"}
    return {"provider": "openai"}


@router.post("/generate-report")
async def generate_report(payload: GenerateReportRequest, access_token: str = Depends(get_bearer_token)):
    """Generate a real downloadable PDF report via ReportLab and return the URL."""
    supabase_client, user_id = get_current_supabase_user(access_token)
    res = export_consultation_report_impl(payload.conversation_id, supabase_client)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to generate report"))
    return res
