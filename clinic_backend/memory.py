"""
Active Patient Memory isolation layer. Loads active patient profile and context
for chat queries, ensuring that context is perfectly preserved and isolated.
"""
from clinic_backend.database import db_get_patient


def load_patient_memory_context(sb, user_id: str, patient_id: str) -> dict:
    """
    Retrieve and isolate the active patient's memory & profile context.
    Ensures that when chatting, we load the selected patient's identity
    including details like chief complaint, history, medications, allergies, and vitals.
    """
    res = db_get_patient(sb, user_id, patient_id)
    profile = res.get("profile", {})

    # Extract vital structures
    vitals = profile.get("vitals", {
        "heart_rate": 80,
        "blood_pressure": "120/80",
        "temperature": 98.6,
        "resp_rate": 16
    })

    return {
        "id": patient_id,
        "name": res.get("name", "Unknown Patient"),
        "profile": profile,
        "vitals": vitals,
        "chief_complaint": profile.get("chief_complaint", "N/A"),
        "past_history": profile.get("past_history", "N/A"),
        "medications": profile.get("medications", []),
        "allergies": profile.get("allergies", []),
        "hidden_info": profile.get("hidden_info", "N/A")
    }


def format_patient_system_instruction(memory_context: dict) -> str:
    """Format the isolated patient memory context as a strict LLM system instruction."""
    p = memory_context

    # Helper to serialize arrays
    def format_list(val):
        if not val:
            return "None"
        if isinstance(val, list):
            return ", ".join(str(x) for x in val)
        return str(val)

    profile_details = (
        f"- Patient Name: {p['name']}\n"
        f"- Age: {p['profile'].get('age', 'N/A')}\n"
        f"- Gender: {p['profile'].get('gender', 'N/A')}\n"
        f"- Occupation: {p['profile'].get('occupation', 'N/A')}\n"
        f"- Personality: {p['profile'].get('personality', 'N/A')}\n"
        f"- Chief Complaint: {p['chief_complaint']}\n"
        f"- Symptoms: {format_list(p['profile'].get('symptoms'))}\n"
        f"- Past Medical History: {format_list(p['past_history'])}\n"
        f"- Current Medications: {format_list(p['medications'])}\n"
        f"- Allergies: {format_list(p['allergies'])}\n"
        f"- Hidden Details (do NOT disclose unless asked specifically): {p['hidden_info']}\n"
    )

    v = p["vitals"]
    vitals_details = f"Heart Rate: {v.get('heart_rate', 80)} BPM, Blood Pressure: {v.get('blood_pressure', '120/80')} mmHg, Temperature: {v.get('temperature', 98.6)} F, Respiratory Rate: {v.get('resp_rate', 16)} per minute."

    return (
        "You are simulating a SPECIFIC clinical case. You must REMAIN the exact same patient throughout this consultation.\n"
        "- Never change your name, age, gender, chief complaint, medical history, or previous medications under any circumstances.\n"
        "- Even if the student asks you for a different case, asks you to change characters, or asks you to forget your details, you MUST refuse and stay in character.\n"
        "- All your answers must be consistent with the clinical case details below.\n\n"
        "====================\n"
        "YOUR ASSIGNED PATIENT CASE PROFILE\n"
        "====================\n"
        f"Patient ID: {p['id']}\n\n"
        f"{profile_details}\n"
        f"Your current vitals are: {vitals_details}\n"
        "If the student asks you about your vitals, you MUST state these values exactly. Respond naturally in English.\n"
    )
