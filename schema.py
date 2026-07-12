from typing import List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    chat_history: List[dict[str, str]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


class SaveMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    user_message: str
    ai_message: str


class SaveMessageResponse(BaseModel):
    conversation_id: str


class ConversationItem(BaseModel):
    id: str
    created_at: Optional[str] = None


class ConversationsResponse(BaseModel):
    conversations: List[ConversationItem]


class MessageItem(BaseModel):
    sender: str
    content: str
    created_at: Optional[str] = None


class HistoryResponse(BaseModel):
    messages: List[MessageItem]
