import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv("d:/Internship/Week 1/llm/AI patient for student/.env")
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

supabase = create_client(url, key)

try:
    res = supabase.table("patients").select("*").limit(1).execute()
    print("Patients table exists!", res.data)
except Exception as e:
    print("Error querying patients table:", e)
