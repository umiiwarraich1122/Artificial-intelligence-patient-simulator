# AI Patient Simulator Tools Documentation

This document describes the native OpenAI Tool Calling architecture integrated into the AI Patient Simulator.

---

## 1. Tool Tiers & Classification

| Tool Name | Classification | Rationale |
| :--- | :--- | :--- |
| `load_patient_case` | **Tier 0 (Read-Only)** | Retrieves patient demographics and medical case parameters from the database. Does not modify state. |
| `load_patient_memory` | **Tier 0 (Read-Only)** | Reads past conversation summaries and patient-specific facts from prior visit logs. Does not modify state. |
| `generate_consultation_summary` | **Tier 0 (Read-Only)** | Saves the clinical intake summary into the database at the end of the session. (Strictly writes state, but grouped under Tier 0 as it is non-interactive for the user). |
| `export_consultation_report` | **Tier 1 (Reversible)** | Compiles dialogue logs and clinical metrics into a PDF file in the backend. Safe to regenerate/re-run anytime. |

---

## 2. Tool Reference & Contracts

### Tool 1: `load_patient_case`
- **Purpose**: Load the active patient case profile from Supabase.
- **Parameters**:
  - `patient_id` (string, required): The unique UUID identifying the patient profile.
- **Returns**: JSON object with `success` flag and `patient` metadata (Name, Age, Gender, Chief Complaint, etc.).
- **Errors**: Returns `{"success": false, "error": "Reason"}` on lookup failure.

### Tool 2: `load_patient_memory`
- **Purpose**: Fetch prior session summaries and facts to maintain patient continuity.
- **Parameters**:
  - `patient_id` (string, required): The unique UUID identifying the patient profile.
- **Returns**: JSON object with list of previous consultation summaries.
- **Errors**: Returns empty list fallback instead of raising raw exceptions.

### Tool 3: `generate_consultation_summary`
- **Purpose**: Generate and store the structured consultation summary in Supabase.
- **Parameters**:
  - `conversation_id` (string, required)
  - `chief_complaint` (string, required)
  - `symptoms` (array of strings, required)
  - `history` (array of strings, required)
  - `timeline` (string, required)
  - `important_facts` (array of strings, required)
  - `missing_questions` (array of strings, required)
  - `highlights` (array of strings, required)
- **Returns**: JSON object confirming storage success.

### Tool 4: `export_consultation_report`
- **Purpose**: Compile a downloadable clinical performance PDF report.
- **Parameters**:
  - `conversation_id` (string, required)
  - `patient_id` (string, optional)
- **Returns**: JSON object containing download URL and filename.

---

## 3. Tool Description Test (Prompting)

### Before (Vague Description)
- **Tool**: `export_consultation_report`
- **Vague Prompt**: `"Generate a report for the consultation."`
- **Failure Case**: When the user typed *"Export this consultation as a PDF"*, the model got confused. It attempted to call `generate_consultation_summary` first, or invented an incorrect argument `student_name` that was not defined in the parameter schema, causing API validation crashes.

### After (Improved Description)
- **Improved Prompt**: `"Compile the entire consultation details, transcript, and clinical evaluation metrics into a downloadable PDF file. Use ONLY when the user explicitly requests to export the consultation as a PDF or download a PDF report."`
- **Result**: The LLM successfully maps user intents like *"Download report"* or *"Export PDF"* to the tool call immediately, with the exact required `conversation_id` parameter.

---

## 4. Token Metrics & Comparisons

### Tool Search (Selective Tool Loading)
- **Naive Implementation** (Loading all 4 tools on every API request):
  - Tool schemas definitions: **~850 input tokens**.
- **Selective Implementation** (Tool Search based on message keywords):
  - Dialogue start: Loads `load_patient_case` & `load_patient_memory` (**~400 input tokens**).
  - Dialogue in-progress: Loads 0 tools (**0 input tokens**).
  - Export requests: Loads `export_consultation_report` (**~200 input tokens**).
- **Average Token Savings per turn**: **~650 tokens** (76% reduction in tool schema overhead).

### Programmatic Path
- **Naive Implementation** (Sending the entire 20-turn conversation history to LLM to write the intake summary):
  - Input tokens: **~2,200 tokens**.
- **Programmatic Implementation** (Preprocessing dialogue statistics programmatically first, sending only condensed statistics to LLM):
  - Preprocessed statistics snippet: **~150 tokens**.
- **Intake Summary Token Savings**: **~2,050 tokens** (93% reduction in prompt size).
