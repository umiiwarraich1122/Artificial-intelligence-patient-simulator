from typing import List
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    chat_history: List[dict[str, str]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
