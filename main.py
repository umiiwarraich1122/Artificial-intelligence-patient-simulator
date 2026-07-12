import os
from pathlib import Path
from typing import Optional
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Header, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from openai import OpenAI
from schema import ChatRequest, ChatResponse
from supabase import create_client
from supabase_auth.errors import AuthApiError

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="AI Chatbot Backend")
client = None


def get_bearer_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    return authorization.split(" ", 1)[1]


def create_supabase_client_for_user(access_token: str):
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase URL or key is missing")

    if not access_token or len(access_token.split(".")) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase access token")

    supabase_client = create_client(url, key)
    try:
        supabase_client.auth.set_session(access_token, "")
    except (AuthApiError, IndexError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase access token")
    return supabase_client


def initialize_client():
    global client
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")

    if not api_key:
        client = None
        return None

    if api_key.startswith("gsk_"):
        client = OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
    else:
        client = OpenAI(api_key=api_key)

    return client


url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    print("⚠️ Supabase URL or key is missing. Check your .env file.")


@app.on_event("startup")
async def startup_event():
    print("🚀 AI Patient Backend is starting...")
    print("📍 Server will be available at http://127.0.0.1:8000")
    initialize_client()

    if not client:
        print("⚠️ OPENAI_API_KEY is not set. Add it to .env before using chat.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

initialize_client()

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are an AI Medical Patient Simulator for medical students. Your role is to act ONLY as a patient. "
        "Do NOT act as an AI or a doctor. "
        
        "CRITICAL SETUP:\n"
        "1. At the very start of the session, internally select ONE random medical condition/disease from a vast pool "
        "(e.g., Diabetes, Typhoid, Malaria, Appendicitis, Hypertension, Asthma, GERD, Migraine, etc.). "
        "Do NOT reveal the name of this disease to the user under any circumstances.\n"
        "2. Keep track of the symptoms associated with your chosen disease.\n"
        
        "CONVERSATION RULES:\n"
        "1. When the student greets you, start by stating only your CHIEF COMPLAINT (the main symptom) in a simple, non-medical way. "
        "2. Do NOT give away all symptoms at once. Reveal other symptoms slowly, ONLY when the user asks specific history-taking questions.\n"
        "3. Language: Mix simple English and Roman Urdu naturally (e.g., 'Mujhe pichle 3 din se bukhar hai aur body pain ho raha hai'). Match the user's language comfort.\n"
        "4. If the student asks you direct medical definitions or asks you to diagnose yourself, reply as a layman: 'Mujhe nahi pata doctor saab, aap check karke batayein.'\n"
        
        "DIAGNOSIS & MEDICINE PHASE:\n"
        "1. The student must explicitly type their final diagnosis (e.g., 'I think you have Typhoid') AND recommend the correct generic medicine/management.\n"
        "2. Once they do both, break character and give them a structured feedback evaluation:\n"
        "   - Tell them if their diagnosis was Correct/Incorrect.\n"
        "   - Tell them what the actual disease was.\n"
        "   - Review if their recommended medicine/treatment plan was safe and accurate."
    )
}

@app.post("/chat", response_model=ChatResponse)
async def chat_with_llm(request: ChatRequest, access_token: str = Depends(get_bearer_token)):
    try:
        initialize_client()
        if client is None:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY missing in .env file.")

        supabase_client = create_supabase_client_for_user(access_token)
        try:
            user_response = supabase_client.auth.get_user(access_token)
        except AuthApiError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase access token")

        if user_response is None or getattr(user_response, "user", None) is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase access token")

        conversation_id = request.conversation_id or str(uuid4())
        conversation_history = list(request.chat_history or [])
        conversation_history.append({"role": "user", "content": request.message})

        api_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
        model_name = "llama-3.3-70b-versatile" if api_key.startswith("gsk_") else "gpt-4o-mini"

        completion = client.chat.completions.create(
            model=model_name,
            messages=[SYSTEM_PROMPT] + conversation_history,
            temperature=0.2,
            max_tokens=150,
            top_p=0.2
        )

        choices = getattr(completion, "choices", None)
        if choices is None:
            raise HTTPException(status_code=500, detail=f"Chat completion returned no choices: {completion}")

        try:
            if len(choices) == 0:
                raise HTTPException(status_code=500, detail=f"Chat completion returned an empty choices list: {completion}")
        except TypeError:
            pass

        try:
            choice = choices[0]
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Chat completion choice access failed: {exc}")

        message_obj = getattr(choice, "message", None)
        bot_reply = None
        if message_obj is not None:
            bot_reply = getattr(message_obj, "content", None)
        if bot_reply is None:
            bot_reply = getattr(choice, "text", None)

        if not bot_reply:
            raise HTTPException(status_code=500, detail=f"Unexpected chat completion format: {completion}")

        return ChatResponse(response=bot_reply, conversation_id=conversation_id)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/")
def home():
    return FileResponse("signup.html")

@app.get("/chat")
def chat_page():
    return FileResponse("index.html")

@app.get("/index.html")
def index_page():
    return FileResponse("index.html")

@app.get("/auth/callback")
async def auth_callback(request: Request):
    return FileResponse(BASE_DIR / "signup.html")

# Server run karne ke liye endpoint checker
@app.get("/status")
def read_root():
    return {"status": "Backend is running successfully!"}


if __name__ == "__main__":
    import uvicorn

    print("▶️ Starting FastAPI server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)