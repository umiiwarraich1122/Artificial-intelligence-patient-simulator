from typing import List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    chat_history: List[dict[str, str]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
