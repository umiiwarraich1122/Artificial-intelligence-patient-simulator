"""
Patient profile generation via LLM with a diverse fallback pool.
"""
import json
import random
from clinic_backend.llm.client import build_client_direct


def _clean_json(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        lines = content.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        lines = lines[:-1] if lines and lines[-1].startswith("```") else lines
        content = "\n".join(lines).strip()
    return content


PROMPT = (
    "Generate a completely new, unique, and highly realistic virtual patient profile. "
    "The patient should have a chief complaint, physical symptoms, timeline, medications, allergies, personality, and hidden medical information "
    "(e.g., hidden lifestyle details like alcohol/smoking, compliance issues, family history) for medical students to discover.\n"
    "Also generate a matching set of vitals:\n"
    "- heart_rate (integer, e.g. 70-110)\n"
    "- blood_pressure (string, e.g. '120/80')\n"
    "- temperature (float, e.g. 97.5-103.5)\n"
    "- resp_rate (integer, e.g. 12-28)\n\n"
    "Return the details STRICTLY formatted as a valid JSON object matching the keys below:\n"
    '{\n'
    '  "name": "Name",\n'
    '  "age": 40,\n'
    '  "gender": "Male/Female",\n'
    '  "occupation": "Occupation",\n'
    '  "personality": "Personality description",\n'
    '  "chief_complaint": "Chief complaint description",\n'
    '  "symptoms": ["symptom 1", "symptom 2"],\n'
    '  "past_history": "Past medical history details",\n'
    '  "medications": ["medication 1"],\n'
    '  "allergies": ["allergy 1"],\n'
    '  "hidden_info": "Secret details not explicitly shared initially",\n'
    '  "vitals": {\n'
    '    "heart_rate": 80,\n'
    '    "blood_pressure": "120/80",\n'
    '    "temperature": 98.6,\n'
    '    "resp_rate": 16\n'
    '  }\n'
    "}\n\n"
    "Return ONLY the JSON. No markdown, no triple backticks."
)

_FALLBACK_PATIENTS = [
    {
        "name": "Arshad Mahmood", "age": 48, "gender": "Male", "occupation": "Tax Accountant",
        "personality": "Quiet, cooperative, anxious about work deadlines.",
        "chief_complaint": "Persistent retrosternal burning pain after meals.",
        "symptoms": ["Heartburn", "Acid reflux", "Dry cough at night"],
        "past_history": "Mild hypertension, controlled by lifestyle.",
        "medications": ["None"], "allergies": ["Sulfa drugs"],
        "hidden_info": "Consumes 4-5 cups of strong coffee daily and eats late-night spicy meals.",
        "vitals": {"heart_rate": 78, "blood_pressure": "130/85", "temperature": 98.6, "resp_rate": 14},
    },
    {
        "name": "Fatima Zahra", "age": 34, "gender": "Female", "occupation": "School Teacher",
        "personality": "Talkative, slightly anxious, tends to downplay symptoms.",
        "chief_complaint": "Severe throbbing headache on the right side for 2 days.",
        "symptoms": ["Unilateral headache", "Nausea", "Photophobia", "Visual aura before headache"],
        "past_history": "Migraines diagnosed 5 years ago, never properly treated.",
        "medications": ["OTC ibuprofen as needed"], "allergies": ["Aspirin"],
        "hidden_info": "Recently started oral contraceptive pills two months ago which can worsen migraines.",
        "vitals": {"heart_rate": 88, "blood_pressure": "118/74", "temperature": 97.9, "resp_rate": 16},
    },
    {
        "name": "David Okonkwo", "age": 62, "gender": "Male", "occupation": "Retired Engineer",
        "personality": "Stoic, reluctant to seek help, minimises symptoms.",
        "chief_complaint": "Increasing shortness of breath on exertion for 3 weeks.",
        "symptoms": ["Dyspnoea on exertion", "Ankle swelling", "Orthopnoea", "Fatigue"],
        "past_history": "Type 2 Diabetes (10 years), hypertension, smoker 30 pack-years.",
        "medications": ["Metformin 500mg BD", "Amlodipine 5mg OD"], "allergies": ["Penicillin"],
        "hidden_info": "Stopped taking Amlodipine 3 weeks ago due to ankle swelling — causing uncontrolled hypertension.",
        "vitals": {"heart_rate": 96, "blood_pressure": "158/96", "temperature": 98.2, "resp_rate": 22},
    },
    {
        "name": "Sana Iqbal", "age": 27, "gender": "Female", "occupation": "Software Developer",
        "personality": "Anxious, health-conscious, researches everything online.",
        "chief_complaint": "Sharp right lower quadrant pain since last night, worse with movement.",
        "symptoms": ["Right iliac fossa pain", "Nausea", "Low-grade fever", "Loss of appetite"],
        "past_history": "No prior surgeries. Pain resolved spontaneously once before.",
        "medications": ["None"], "allergies": ["None known"],
        "hidden_info": "LMP was 7 weeks ago and pregnancy test has not been done — ectopic pregnancy must be ruled out.",
        "vitals": {"heart_rate": 102, "blood_pressure": "110/70", "temperature": 100.4, "resp_rate": 18},
    },
    {
        "name": "Khalid Al-Rashid", "age": 55, "gender": "Male", "occupation": "Restaurant Owner",
        "personality": "Friendly, talkative, delays medical visits.",
        "chief_complaint": "Frequent urination at night and excessive thirst for 2 months.",
        "symptoms": ["Polyuria", "Polydipsia", "Blurred vision", "Unintentional weight loss of 5 kg"],
        "past_history": "Family history of diabetes. BMI 31.",
        "medications": ["None"], "allergies": ["Sulfonamides"],
        "hidden_info": "Drinks large amounts of sweetened juice. Fasting blood glucose not checked in 3 years.",
        "vitals": {"heart_rate": 82, "blood_pressure": "135/88", "temperature": 98.4, "resp_rate": 15},
    },
    {
        "name": "Maria Santos", "age": 41, "gender": "Female", "occupation": "Nurse",
        "personality": "Knowledgeable but evasive about her own health.",
        "chief_complaint": "Palpitations and occasional chest tightness for 4 weeks.",
        "symptoms": ["Palpitations", "Chest tightness", "Heat intolerance", "Weight loss", "Hand tremor"],
        "past_history": "No significant medical history. Non-smoker.",
        "medications": ["None"], "allergies": ["Iodine contrast"],
        "hidden_info": "Taking herbal thyroid-boosting supplements purchased online without medical advice.",
        "vitals": {"heart_rate": 112, "blood_pressure": "125/70", "temperature": 99.1, "resp_rate": 17},
    },
    {
        "name": "James Whitfield", "age": 70, "gender": "Male", "occupation": "Retired Teacher",
        "personality": "Cooperative, slightly confused about medication names.",
        "chief_complaint": "Sudden onset of confusion and left-sided weakness this morning.",
        "symptoms": ["Left arm weakness", "Left facial droop", "Slurred speech", "Sudden severe headache"],
        "past_history": "Atrial fibrillation, hypertension, previous TIA 2 years ago.",
        "medications": ["Warfarin 5mg OD", "Bisoprolol 2.5mg OD", "Ramipril 5mg OD"], "allergies": ["Codeine"],
        "hidden_info": "Missed last 4 doses of Warfarin because he ran out and did not refill prescription.",
        "vitals": {"heart_rate": 76, "blood_pressure": "178/100", "temperature": 98.0, "resp_rate": 18},
    },
    {
        "name": "Ranjit Singh", "age": 58, "gender": "Male", "occupation": "Truck Driver",
        "personality": "Gruff, dismissive, only came because wife insisted.",
        "chief_complaint": "Persistent cough with blood-streaked sputum for 6 weeks.",
        "symptoms": ["Haemoptysis", "Night sweats", "Weight loss 8 kg", "Low-grade fever"],
        "past_history": "Heavy smoker (40 pack-years).",
        "medications": ["None"], "allergies": ["None known"],
        "hidden_info": "Recently returned from 3 months in a high TB-prevalence region staying in crowded conditions.",
        "vitals": {"heart_rate": 90, "blood_pressure": "128/82", "temperature": 99.8, "resp_rate": 20},
    },
    {
        "name": "Priya Nair", "age": 38, "gender": "Female", "occupation": "Accountant",
        "personality": "Articulate, well-prepared, brings a written list of symptoms.",
        "chief_complaint": "Fatigue, cold intolerance, and constipation for 3 months.",
        "symptoms": ["Fatigue", "Cold intolerance", "Constipation", "Weight gain 4 kg", "Dry skin", "Hair thinning"],
        "past_history": "Mother has Hashimoto's thyroiditis.",
        "medications": ["Iron supplements"], "allergies": ["None"],
        "hidden_info": "Taking high-dose biotin supplements for hair loss, which can falsely alter thyroid function test results.",
        "vitals": {"heart_rate": 58, "blood_pressure": "108/70", "temperature": 97.4, "resp_rate": 13},
    },
    {
        "name": "Aisha Bello", "age": 23, "gender": "Female", "occupation": "University Student",
        "personality": "Shy, embarrassed about symptoms, avoids eye contact.",
        "chief_complaint": "Painful periods and lower abdominal cramping for 6 months.",
        "symptoms": ["Severe dysmenorrhoea", "Pelvic pain mid-cycle", "Painful intercourse", "Bloating"],
        "past_history": "Regular periods since age 13. No pregnancies.",
        "medications": ["Mefenamic acid PRN"], "allergies": ["None"],
        "hidden_info": "Also has painful defecation — highly suggestive of endometriosis. Has not told her family.",
        "vitals": {"heart_rate": 80, "blood_pressure": "112/68", "temperature": 98.2, "resp_rate": 14},
    },
]


def generate_patient_via_llm() -> dict:
    """Generate a unique patient profile via LLM with fallback to the pool."""
    gen_client, models_to_try = build_client_direct()

    if gen_client:
        last_err = None
        for model_name in models_to_try:
            try:
                response = gen_client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": PROMPT}],
                    temperature=0.9,
                    max_tokens=700,
                )
                content = _clean_json(response.choices[0].message.content.strip())
                parsed = json.loads(content)
                print(f"[Patient Gen] Generated '{parsed.get('name')}' via {model_name}")
                return parsed
            except Exception as e:
                print(f"[Patient Gen] Model {model_name} failed: {e}")
                last_err = e
        print(f"[Patient Gen] All models failed: {last_err}. Using fallback.")

    return random.choice(_FALLBACK_PATIENTS)
