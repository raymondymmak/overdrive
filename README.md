# Overdrive

Career & lab intelligence engine: FastAPI backend (`main.py`, Gemini 2.5 Flash with deterministic fallbacks) + React frontend (`frontend/`).

## Run the backend

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

REST: `/api/targets`, `/api/dossier`, `/api/blitz`, `/api/voice-interview`, `/api/vault`, `/api/recon`, `/bridge`.
MCP (streamable HTTP, stateless, no auth): `http://localhost:8000/mcp`

## Connect to Superhuman Go

1. Run the backend (above).
2. Expose it publicly: `cloudflared tunnel --url http://localhost:8000` (or `ngrok http 8000`) and copy the `https://` URL.
3. In Superhuman Go's **Agent Builder**, create an agent named **Overdrive**.
4. **Tools and Access > + Add connections > MCP URL**: `https://<tunnel>/mcp`. Go will list the tools:
   `create_dossier`, `get_vault`, `list_targets`, `generate_outreach_batch`, `start_mock_interview`.
5. Enable **Web access** and **Superhuman Docs**.
6. Paste these agent instructions:

> You are Overdrive, my career and research-lab outreach copilot.
> When I'm viewing a careers page, job posting, research lab or faculty page, or startup/VC site, or when I receive a recruiter or hiring email:
> 1. Read the full visible page or email text. Identify the organization name and the role (if no role is stated, infer the closest fit from my vault).
> 2. Call `create_dossier` with `target_name`, `role`, and `raw_page_text` set to the page or email text.
> 3. Summarize the dossier in 3–5 bullets: fit score, cultural DNA, and secret hiring filters.
> 4. Take `draftEmail` and use the Grammarly agent to polish it so it's concise, confident, and specific (4 sentences max, keep every concrete metric). Show me the subject and body.
> 5. Show the `tailoredCvChanges` as a before → after list with the one-line rationale for each, and ask me to approve, edit, or reject each change. Never send email or change my CV without my explicit approval.
> If I ask about my background, call `get_vault`. If I ask "what am I tracking", call `list_targets`. For bulk outreach ("find me 10 robotics professors"), call `generate_outreach_batch` (max 10). To practice, call `start_mock_interview` with the org and my answer (an empty answer gets the first question).

7. Suggested trigger: *"When I open a careers, jobs, lab, or faculty page, or receive an email from a recruiter or hiring manager, run Overdrive."* (Manual phrase: "Overdrive this page.")

Results show up live in the React dashboard, which polls `/api/targets`.
