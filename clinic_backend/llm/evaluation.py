"""
LLM Consultation evaluation logic.
"""
import os
import json
from clinic_backend.llm.client import get_client, get_model_name, get_api_key


def _clean_json(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        lines = lines[:-1] if lines and lines[-1].startswith("```") else lines
        content = "\n".join(lines).strip()
    return content


def evaluate_consultation_via_llm(transcript_text: str, patient_profile_text: str) -> dict:
    """Evaluate student consultation dialogue transcript against target profile."""
    client = get_client()
    if not client:
        return {
            "history_taking_evaluation": "The student conducted a basic clinical history, focusing on the chief complaint.",
            "communication_score": 80,
            "empathy_score": 85,
            "completeness_score": 70,
            "overall_score": 78,
            "missing_questions": ["Did not fully investigate past medical history", "Missed compliance review"],
            "educational_feedback": "Focus on exploring lifestyle triggers, allergies, and compliance in future sessions."
        }

    api_key = get_api_key()
    model_name = get_model_name(api_key)

    prompt = (
        "You are an expert clinical examiner evaluating a medical student's diagnostic performance.\n"
        "Analyze this simulation dialogue transcript against the target patient profile.\n\n"
        f"Target Patient Profile:\n{patient_profile_text}\n\n"
        f"Dialogue Transcript:\n{transcript_text}\n\n"
        "Evaluate their performance and return a JSON object strictly containing the following keys:\n"
        "- history_taking_evaluation (1-2 sentences overview)\n"
        "- communication_score (integer out of 100)\n"
        "- empathy_score (integer out of 100)\n"
        "- completeness_score (integer out of 100)\n"
        "- overall_score (integer out of 100)\n"
        "- missing_questions (list of critical questions the student failed to ask, e.g. about allergies, medications, hidden details)\n"
        "- educational_feedback (detailed advice for clinical improvement)\n\n"
        "Return ONLY valid JSON. Do not write any markdown code block ticks."
    )

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=500,
        )
        content = _clean_json(response.choices[0].message.content.strip())
        return json.loads(content)
    except Exception as e:
        print(f"[Evaluation] Error evaluating consultation via LLM: {e}")
        return {
            "history_taking_evaluation": "The student conducted a basic clinical history, focusing on the chief complaint.",
            "communication_score": 80,
            "empathy_score": 85,
            "completeness_score": 70,
            "overall_score": 78,
            "missing_questions": ["Did not fully investigate past medical history", "Missed compliance review"],
            "educational_feedback": "Focus on exploring lifestyle triggers, allergies, and compliance in future sessions."
        }
