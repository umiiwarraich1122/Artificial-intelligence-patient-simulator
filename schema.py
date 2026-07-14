from typing import List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    patient_id: Optional[str] = None


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
    summary: Optional[str] = None
    message_count: Optional[int] = 0
    last_updated: Optional[str] = None
    duration_mins: Optional[int] = 0
    patient_id: Optional[str] = None
    is_patient_profile: Optional[bool] = False


class UpdateSummaryRequest(BaseModel):
    conversation_id: str
    custom_title: Optional[str] = None
    pinned: Optional[bool] = None
    status: Optional[str] = None
    patient_id: Optional[str] = None


class ConversationsResponse(BaseModel):
    conversations: List[ConversationItem]


class MessageItem(BaseModel):
    sender: str
    content: str
    created_at: Optional[str] = None


class HistoryResponse(BaseModel):
    messages: List[MessageItem]


class GenerateReportRequest(BaseModel):
    conversation_id: str
