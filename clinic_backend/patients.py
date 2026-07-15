"""
Router for patient and project management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from clinic_backend.auth import get_bearer_token, get_current_supabase_user
from clinic_backend.database import (
    db_create_patient,
    db_list_patients,
    db_get_patient,
    db_get_patient_history,
    db_delete_patient
)
from clinic_backend.llm.patient_gen import generate_patient_via_llm

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("")
async def create_patient_endpoint(access_token: str = Depends(get_bearer_token)):
    """Create a completely new patient/project."""
    sb, user_id = get_current_supabase_user(access_token)
    try:
        profile_data = generate_patient_via_llm()
        name = profile_data.get("name", "New Patient")
        patient = db_create_patient(sb, user_id, name, profile_data)
        return patient
    except Exception as e:
        print(f"[Patients Router] Error creating patient: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_patients_endpoint(access_token: str = Depends(get_bearer_token)):
    """List all patient projects."""
    sb, user_id = get_current_supabase_user(access_token)
    try:
        patients = db_list_patients(sb, user_id)
        return {"patients": patients}
    except Exception as e:
        print(f"[Patients Router] Error listing patients: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{patient_id}")
async def get_patient_endpoint(patient_id: str, access_token: str = Depends(get_bearer_token)):
    """Retrieve details for a single patient project."""
    sb, user_id = get_current_supabase_user(access_token)
    try:
        patient = db_get_patient(sb, user_id, patient_id)
        return patient
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patients Router] Error getting patient: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{patient_id}/history")
async def get_patient_history_endpoint(patient_id: str, access_token: str = Depends(get_bearer_token)):
    """Retrieve full message history for a single patient project."""
    sb, user_id = get_current_supabase_user(access_token)
    try:
        # Check patient existence first
        db_get_patient(sb, user_id, patient_id)
        history = db_get_patient_history(sb, user_id, patient_id)
        return {"messages": history}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patients Router] Error getting patient history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{patient_id}")
async def delete_patient_endpoint(patient_id: str, access_token: str = Depends(get_bearer_token)):
    """Delete a patient project and all associated logs."""
    sb, user_id = get_current_supabase_user(access_token)
    try:
        db_get_patient(sb, user_id, patient_id)
        db_delete_patient(sb, user_id, patient_id)
        return {"message": "Patient deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Patients Router] Error deleting patient: {e}")
        raise HTTPException(status_code=500, detail=str(e))
