"""
Clinical summary generation — produces a short title + summary string for a
conversation and stores it as a __SUMMARY_JSON__ message in the database.
"""
import re
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


def generate_clinical_summary(conversation_history: list) -> str:
    """Analyse a list of message dicts and return a JSON string with title/summary."""
    client = get_client()

    first_patient_msg = ""
    total_messages = len(conversation_history)
    total_chars = 0
    user_msgs: list[str] = []
    ai_msgs: list[str] = []

    for msg in conversation_history:
        content_text = msg.get("content", "")
        if content_text.startswith("__"):
            continue
        total_chars += len(content_text)
        if msg.get("sender") == "user":
            user_msgs.append(content_text)
        else:
            ai_msgs.append(content_text)
            if not first_patient_msg:
                first_patient_msg = content_text

    avg_length = int(total_chars / total_messages) if total_messages > 0 else 0
    last_user_msg = user_msgs[-1] if user_msgs else "None"
    last_ai_msg = ai_msgs[-1] if ai_msgs else "None"

    # Build fallback values from raw text
    fallback_title = "New Consultation"
    if first_patient_msg:
        sentences = re.split(r"[.!?]", first_patient_msg)
        first_sentence = sentences[0].strip() if sentences else first_patient_msg
        fallback_title = (first_sentence[:37] + "...") if len(first_sentence) > 40 else first_sentence
    fallback_summary = (
        (first_patient_msg[:77] + "...")
        if len(first_patient_msg) > 80
        else first_patient_msg
    )

    default_data = {
        "title": fallback_title,
        "summary": fallback_summary,
        "pinned": False,
        "custom_title": None,
        "status": "In Progress",
    }

    if not client:
        return json.dumps(default_data)

    programmatic_stats = (
        f"Dialogue Stats:\n"
        f"- Total Messages: {total_messages}\n"
        f"- Average Message Length: {avg_length} characters\n"
        f"- Last Clinician Inquiry: {last_user_msg}\n"
        f"- Last Patient Response: {last_ai_msg}\n"
    )

    prompt = (
        "You are an expert medical scribe. Analyse these conversation statistics and highlights, "
        "and output a JSON object containing:\n"
        "1. 'title': A short, professional clinical title of 3-5 words summarising the chief complaint "
        "(e.g. 'Severe Abdominal Pain', 'Fever and Persistent Cough'). Do not use generic names or quotes.\n"
        "2. 'summary': A concise clinical summary of 1-2 lines, maximum 80 characters, describing the patient's symptoms.\n\n"
        "Format your response as a valid JSON object ONLY. Example:\n"
        '{\n  "title": "Acute Back Pain",\n  "summary": "Patient reports sudden lumbar pain after lifting heavy boxes yesterday."\n}\n\n'
        f"{programmatic_stats}"
    )

    try:
        api_key = get_api_key()
        model = get_model_name(api_key)
        kwargs: dict = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 100,
        }
        # response_format only supported by OpenAI, not Groq/Cerebras
        if not (api_key.startswith("gsk_") or api_key.startswith("csk-")):
            kwargs["response_format"] = {"type": "json_object"}

        response = client.chat.completions.create(**kwargs)
        content = _clean_json(response.choices[0].message.content.strip())
        data = json.loads(content)

        title = data.get("title", fallback_title)
        summary = data.get("summary", fallback_summary)
        if len(summary) > 80:
            summary = summary[:77] + "..."

        default_data["title"] = title
        default_data["summary"] = summary
    except Exception as e:
        print(f"[Summary] Error generating clinical summary: {e}")

    return json.dumps(default_data)
