"""
Pydantic request/response schemas.
"""
from typing import List, Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    patient_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str


class SaveMessageRequest(BaseModel):
    conversation_id: Optional[str] = None
    user_message: str
    ai_message: str


class SaveMessageResponse(BaseModel):
    conversation_id: str


class ConversationsResponse(BaseModel):
    conversations: List[dict]


class HistoryResponse(BaseModel):
    messages: List[dict]


class UpdateSummaryRequest(BaseModel):
    conversation_id: str
    custom_title: Optional[str] = None
    pinned: Optional[bool] = None
    status: Optional[str] = None


class GenerateReportRequest(BaseModel):
    conversation_id: str
