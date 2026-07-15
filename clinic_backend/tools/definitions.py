"""
Function tool definitions and implementations for FastAPI + LLM router.
"""
import json
from clinic_backend.reports.pdf import generate_pdf_report
from clinic_backend.llm.evaluation import evaluate_consultation_via_llm

tools = [
    {
        "type": "function",
        "function": {
            "name": "load_patient_case",
            "description": "Load the active patient's clinical case details. Use ONLY when a new consultation starts or when a patient is first selected.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The unique UUID of the patient profile."
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "load_patient_memory",
            "description": "Retrieve previous visit histories, symptoms, visit summaries, medications, and allergies for clinical continuity. Use ONLY when continuing a patient's consultation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The unique UUID of the patient profile."
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_consultation_summary",
            "description": "Analyze the conversation and generate a structured clinical summary at the end of the interview. Saves it in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {
                        "type": "string",
                        "description": "The unique UUID of the conversation session."
                    },
                    "chief_complaint": {
                        "type": "string",
                        "description": "The chief complaint discussed."
                    },
                    "symptoms": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key symptoms discussed."
                    },
                    "history": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key history elements collected."
                    },
                    "timeline": {
                        "type": "string",
                        "description": "Timeline of symptoms."
                    },
                    "important_facts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key facts disclosed by the patient."
                    },
                    "missing_questions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Critical questions the student missed."
                    },
                    "highlights": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key dialogue highlights."
                    }
                },
                "required": ["conversation_id", "chief_complaint", "symptoms", "history", "timeline", "important_facts", "missing_questions", "highlights"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_consultation_report",
            "description": "Compile the entire consultation details, transcript, and clinical evaluation metrics into a downloadable PDF file. Use ONLY when the user explicitly requests to export the consultation as a PDF or download a PDF report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {
                        "type": "string",
                        "description": "The unique UUID of the conversation session."
                    }
                },
                "required": ["conversation_id"]
            }
        }
    }
]


def load_patient_case_impl(patient_id: str, supabase_client) -> dict:
    print("TOOL CALLED: load_patient_case")
    try:
        res = supabase_client.table("messages").select("content").eq("conversation_id", patient_id).execute()
        for row in res.data or []:
            content = row.get("content", "")
            if content.startswith("__PATIENT_PROFILE_JSON__:"):
                profile = json.loads(content[len("__PATIENT_PROFILE_JSON__:") :])
                return {"success": True, "patient": profile}
        return {"success": False, "error": f"Patient case with ID {patient_id} not found."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def load_patient_memory_impl(patient_id: str, supabase_client) -> dict:
    print("TOOL CALLED: load_patient_memory")
    try:
        res = supabase_client.table("messages").select("content").ilike("content", "__SUMMARY_JSON__:%").execute()
        past_consultations = []
        for row in res.data or []:
            content = row.get("content", "")
            try:
                meta = json.loads(content[len("__SUMMARY_JSON__:") :])
                if meta.get("patient_id") == patient_id:
                    past_consultations.append({
                        "chief_complaint": meta.get("chief_complaint", "N/A"),
                        "symptoms": meta.get("symptoms", []),
                        "history": meta.get("history", []),
                        "timeline": meta.get("timeline", "N/A"),
                        "important_facts": meta.get("important_facts", []),
                        "highlights": meta.get("highlights", [])
                    })
            except Exception:
                continue
        return {"success": True, "memory": past_consultations}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_consultation_summary_impl(
    conversation_id: str,
    chief_complaint: str,
    symptoms: list,
    history: list,
    timeline: str,
    important_facts: list,
    missing_questions: list,
    highlights: list,
    supabase_client
) -> dict:
    print("TOOL CALLED: generate_consultation_summary")
    try:
        res_summary = supabase_client.table("messages").select("id, content").eq("conversation_id", conversation_id).ilike("content", "__SUMMARY_JSON__:%").execute()

        summary_data = {
            "title": chief_complaint[:30] or "Consultation Summary",
            "summary": f"Discussion about {chief_complaint}.",
            "chief_complaint": chief_complaint,
            "symptoms": symptoms,
            "history": history,
            "timeline": timeline,
            "important_facts": important_facts,
            "missing_questions": missing_questions,
            "highlights": highlights,
            "status": "Completed"
        }

        if res_summary.data:
            row_id = res_summary.data[0]["id"]
            try:
                old_json = json.loads(res_summary.data[0]["content"][len("__SUMMARY_JSON__:") :])
                summary_data["custom_title"] = old_json.get("custom_title")
                summary_data["pinned"] = old_json.get("pinned", False)
                summary_data["patient_id"] = old_json.get("patient_id")
            except Exception:
                pass

            json_content = f"__SUMMARY_JSON__:{json.dumps(summary_data)}"
            supabase_client.table("messages").update({"content": json_content}).eq("id", row_id).execute()
        else:
            json_content = f"__SUMMARY_JSON__:{json.dumps(summary_data)}"
            supabase_client.table("messages").insert({
                "conversation_id": conversation_id,
                "sender": "ai",
                "content": json_content
            }).execute()

        return {"success": True, "message": "Consultation summary saved successfully."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def export_consultation_report_impl(conversation_id: str, supabase_client) -> dict:
    print("TOOL CALLED: export_consultation_report")
    try:
        res_msgs = supabase_client.table("messages").select("sender, content, created_at").eq("conversation_id", conversation_id).order("created_at").execute()
        transcript = []
        summary_data = None
        patient_id = None

        for row in res_msgs.data or []:
            content = row.get("content", "")
            if content.startswith("__SUMMARY_JSON__"):
                try:
                    summary_data = json.loads(content[len("__SUMMARY_JSON__:") :])
                    patient_id = summary_data.get("patient_id")
                except Exception:
                    pass
            elif content.startswith("__PATIENT_PROFILE_JSON__"):
                pass
            else:
                transcript.append({
                    "sender": row.get("sender"),
                    "content": content
                })

        patient_info = {}
        if patient_id:
            res_profile = supabase_client.table("messages").select("content").eq("conversation_id", patient_id).execute()
            for row in res_profile.data or []:
                content = row.get("content", "")
                if content.startswith("__PATIENT_PROFILE_JSON__:"):
                    try:
                        patient_info = json.loads(content[len("__PATIENT_PROFILE_JSON__:") :])
                    except Exception:
                        pass

        transcript_text = ""
        for m in transcript:
            role = "Clinician" if m["sender"] == "user" else "Patient"
            transcript_text += f"{role}: {m['content']}\n"

        patient_profile_text = json.dumps(patient_info, indent=2)
        evaluation = evaluate_consultation_via_llm(transcript_text, patient_profile_text)

        patient_name = patient_info.get("name", "Unknown Patient")
        generate_pdf_report(patient_id, patient_info, conversation_id, transcript, summary_data, evaluation)

        return {
            "success": True,
            "download_url": f"/static/reports/{conversation_id}.pdf",
            "filename": f"{patient_name.replace(' ', '_')}_Report.pdf"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
