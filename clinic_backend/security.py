"""
Security — input validation and jailbreak/prompt-injection detection.
"""
import re
import logging
from fastapi import HTTPException
from clinic_backend.config import MAX_MESSAGE_LENGTH

logging.basicConfig(
    filename="security.log",
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
)

JAILBREAK_PATTERNS = [
    r"ignore.*instruction",
    r"ignore.*previous",
    r"forget.*role",
    r"system prompt",
    r"hidden prompt",
    r"developer mode",
    r"reveal.*prompt",
    r"print.*prompt",
    r"become chatgpt",
    r"act as",
    r"pretend",
    r"you are now",
    r"override",
]

BLOCKED_OUTPUT_PHRASES = [
    "system prompt",
    "hidden instructions",
    "you are an ai medical patient simulator",
    "role and scope",
    "security rules",
    "privacy",
]


def validate_user_input(message: str) -> None:
    """Raise HTTP 400 if the message is empty or too long."""
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Message exceeds {MAX_MESSAGE_LENGTH} characters.",
        )


def log_if_suspicious(message: str) -> None:
    """Log a warning if the message looks like a jailbreak attempt."""
    lower = message.lower()
    for pattern in JAILBREAK_PATTERNS:
        if re.search(pattern, lower):
            logging.warning(f"Possible jailbreak attempt: {message}")
            break


def validate_model_output(reply: str) -> str:
    """Redact any reply that appears to leak internal instructions."""
    lower = reply.lower()
    for phrase in BLOCKED_OUTPUT_PHRASES:
        if phrase in lower:
            logging.warning("Blocked response — appeared to expose internal instructions.")
            return (
                "I'm sorry, but I can't reveal my internal instructions. "
                "Let's continue the patient simulation."
            )
    return reply
