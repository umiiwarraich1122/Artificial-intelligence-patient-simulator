"""
Database abstraction layer. Supports both native schema (patients + conversations tables)
and fallback schema (conversations + messages tables with metadata prefixing).
"""
import json
from uuid import uuid4
from datetime import datetime
from fastapi import HTTPException

_use_native = None

def check_schema(sb) -> bool:
    """Check if the native patients table exists."""
    global _use_native
    if _use_native is not None:
        return _use_native
    try:
        sb.table("patients").select("id").limit(1).execute()
        _use_native = True
    except Exception:
        _use_native = False
    return _use_native


def db_create_patient(sb, user_id: str, name: str, profile_data: dict) -> dict:
    """Create a new patient record and store their initial profile."""
    patient_id = str(uuid4())
    now_str = datetime.now().isoformat()
    profile_data["created_at"] = now_str
    profile_data["name"] = name

    use_native = check_schema(sb)
    if use_native:
        try:
            # Native schema
            sb.table("patients").insert({
                "id": patient_id,
                "name": name,
                "created_at": now_str,
                "user_id": user_id
            }).execute()
        except Exception:
            # Fallback in case user_id column doesn't exist in native patients table
            sb.table("patients").insert({
                "id": patient_id,
                "name": name,
                "created_at": now_str
            }).execute()

        # Save the full profile metadata as a special message
        sb.table("conversations").insert({
            "patient_id": patient_id,
            "role": "system",
            "message": f"__PATIENT_PROFILE_JSON__:{json.dumps(profile_data)}",
            "timestamp": now_str
        }).execute()
    else:
        # Fallback schema (conversations as patients, messages as history/metadata)
        sb.table("conversations").insert({
            "id": patient_id,
            "user_id": user_id,
            "created_at": now_str
        }).execute()

        sb.table("messages").insert({
            "conversation_id": patient_id,
            "sender": "ai",
            "content": f"__PATIENT_PROFILE_JSON__:{json.dumps(profile_data)}"
        }).execute()

    return {"id": patient_id, "name": name, "created_at": now_str, "profile": profile_data}


def db_list_patients(sb, user_id: str) -> list:
    """Retrieve all patients for the user."""
    use_native = check_schema(sb)
    patients = []

    if use_native:
        try:
            res = sb.table("patients").select("id, name, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        except Exception:
            # RLS or column difference, query all and filter if needed
            res = sb.table("patients").select("id, name, created_at").order("created_at", desc=True).execute()

        for row in res.data or []:
            patients.append({
                "id": row["id"],
                "name": row["name"],
                "created_at": row["created_at"]
            })
    else:
        # Fallback schema
        convo_res = sb.table("conversations").select("id, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        convo_ids = [c["id"] for c in convo_res.data or []]
        if not convo_ids:
            return []

        profiles_res = (
            sb.table("messages")
            .select("conversation_id, content")
            .in_("conversation_id", convo_ids)
            .ilike("content", "__PATIENT_PROFILE_JSON__:%")
            .execute()
        )

        created_map = {c["id"]: c["created_at"] for c in convo_res.data or []}
        for row in profiles_res.data or []:
            try:
                prof = json.loads(row["content"][len("__PATIENT_PROFILE_JSON__:") :])
                patients.append({
                    "id": row["conversation_id"],
                    "name": prof.get("name", "Unknown Patient"),
                    "created_at": created_map.get(row["conversation_id"])
                })
            except Exception:
                continue

    # Ensure stable sorting by creation date
    patients.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return patients


def db_get_patient(sb, user_id: str, patient_id: str) -> dict:
    """Get single patient details (name, created_at, and profile data)."""
    use_native = check_schema(sb)
    name = "Unknown Patient"
    created_at = None
    profile = {}

    if use_native:
        res = sb.table("patients").select("id, name, created_at").eq("id", patient_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Patient not found")
        name = res.data[0]["name"]
        created_at = res.data[0]["created_at"]

        # Fetch profile metadata
        meta_res = sb.table("conversations").select("message").eq("patient_id", patient_id).ilike("message", "__PATIENT_PROFILE_JSON__:%").execute()
        if meta_res.data:
            try:
                profile = json.loads(meta_res.data[0]["message"][len("__PATIENT_PROFILE_JSON__:") :])
            except Exception:
                pass
    else:
        # Fallback schema
        convo = sb.table("conversations").select("id, created_at").eq("id", patient_id).execute()
        if not convo.data:
            raise HTTPException(status_code=404, detail="Patient not found")
        created_at = convo.data[0]["created_at"]

        prof_res = sb.table("messages").select("content").eq("conversation_id", patient_id).ilike("content", "__PATIENT_PROFILE_JSON__:%").execute()
        if prof_res.data:
            try:
                profile = json.loads(prof_res.data[0]["content"][len("__PATIENT_PROFILE_JSON__:") :])
                name = profile.get("name", name)
            except Exception:
                pass

    return {
        "id": patient_id,
        "name": name,
        "created_at": created_at,
        "profile": profile
    }


def db_get_patient_history(sb, user_id: str, patient_id: str) -> list:
    """Retrieve full conversation history for a patient (excluding metadata)."""
    use_native = check_schema(sb)
    history = []

    if use_native:
        res = sb.table("conversations").select("id, role, message, timestamp").eq("patient_id", patient_id).order("timestamp", desc=False).execute()
        for row in res.data or []:
            msg_txt = row.get("message", "")
            if msg_txt.startswith("__PATIENT_PROFILE_JSON__") or msg_txt.startswith("__SUMMARY_JSON__"):
                continue
            history.append({
                "id": row["id"],
                "patient_id": patient_id,
                "role": row["role"],
                "message": msg_txt,
                "timestamp": row["timestamp"]
            })
    else:
        # Fallback schema
        res = sb.table("messages").select("id, sender, content, created_at").eq("conversation_id", patient_id).order("created_at", desc=False).execute()
        for row in res.data or []:
            msg_txt = row.get("content", "")
            if msg_txt.startswith("__PATIENT_PROFILE_JSON__") or msg_txt.startswith("__SUMMARY_JSON__"):
                continue
            history.append({
                "id": row["id"],
                "patient_id": patient_id,
                "role": row["sender"],
                "message": msg_txt,
                "timestamp": row["created_at"]
            })

    return history


def db_save_message(sb, patient_id: str, role: str, message: str) -> dict:
    """Save a user or assistant message to the patient's conversation history."""
    now_str = datetime.now().isoformat()
    use_native = check_schema(sb)

    if use_native:
        res = sb.table("conversations").insert({
            "patient_id": patient_id,
            "role": role,
            "message": message,
            "timestamp": now_str
        }).execute()
        record = res.data[0] if res.data else {}
        return {
            "id": record.get("id"),
            "patient_id": patient_id,
            "role": role,
            "message": message,
            "timestamp": now_str
        }
    else:
        # Fallback schema
        res = sb.table("messages").insert({
            "conversation_id": patient_id,
            "sender": role,
            "content": message
        }).execute()
        record = res.data[0] if res.data else {}
        return {
            "id": record.get("id"),
            "patient_id": patient_id,
            "role": role,
            "message": message,
            "timestamp": now_str
        }


def db_delete_patient(sb, user_id: str, patient_id: str) -> bool:
    """Delete a patient record and all their conversation history."""
    use_native = check_schema(sb)

    if use_native:
        # Delete history from conversations table
        sb.table("conversations").delete().eq("patient_id", patient_id).execute()
        # Delete from patients table
        sb.table("patients").delete().eq("id", patient_id).execute()
    else:
        # Fallback schema - conversations table cascade deletes messages
        sb.table("conversations").delete().eq("id", patient_id).execute()

    return True


def db_get_patient_summary(sb, patient_id: str) -> dict:
    """Get or build the clinical summary for a patient's case."""
    use_native = check_schema(sb)
    summary_data = {}

    if use_native:
        res = sb.table("conversations").select("id, message").eq("patient_id", patient_id).ilike("message", "__SUMMARY_JSON__:%").execute()
        if res.data:
            try:
                summary_data = json.loads(res.data[0]["message"][len("__SUMMARY_JSON__:") :])
            except Exception:
                pass
    else:
        res = sb.table("messages").select("id, content").eq("conversation_id", patient_id).ilike("content", "__SUMMARY_JSON__:%").execute()
        if res.data:
            try:
                summary_data = json.loads(res.data[0]["content"][len("__SUMMARY_JSON__:") :])
            except Exception:
                pass

    return summary_data


def db_save_patient_summary(sb, patient_id: str, summary_data: dict) -> None:
    """Save or update the clinical summary metadata for a patient."""
    use_native = check_schema(sb)
    now_str = datetime.now().isoformat()
    json_val = f"__SUMMARY_JSON__:{json.dumps(summary_data)}"

    if use_native:
        res = sb.table("conversations").select("id").eq("patient_id", patient_id).ilike("message", "__SUMMARY_JSON__:%").execute()
        if res.data:
            sb.table("conversations").update({"message": json_val}).eq("id", res.data[0]["id"]).execute()
        else:
            sb.table("conversations").insert({
                "patient_id": patient_id,
                "role": "ai",
                "message": json_val,
                "timestamp": now_str
            }).execute()
    else:
        res = sb.table("messages").select("id").eq("conversation_id", patient_id).ilike("content", "__SUMMARY_JSON__:%").execute()
        if res.data:
            sb.table("messages").update({"content": json_val}).eq("id", res.data[0]["id"]).execute()
        else:
            sb.table("messages").insert({
                "conversation_id": patient_id,
                "sender": "ai",
                "content": json_val
            }).execute()
