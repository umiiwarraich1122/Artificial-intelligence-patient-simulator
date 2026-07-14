import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv("d:/Internship/Week 1/llm/AI patient for student/.env")
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

supabase = create_client(url, key)

try:
    # Try calling a raw SQL executor RPC if it exists
    res = supabase.rpc("execute_sql", {"query": "SELECT 1"}).execute()
    print("execute_sql RPC works!", res.data)
except Exception as e:
    print("execute_sql RPC failed:", e)
