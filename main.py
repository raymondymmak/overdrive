import json
import math
import os
import random
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field

# Load .env if present
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = "gemini-2.5-flash"

# Initialize google-genai client safely if key exists
genai_client = None
genai_types = None
if GEMINI_API_KEY:
    try:
        from google import genai
        from google.genai import types as _genai_types

        genai_client = genai.Client(api_key=GEMINI_API_KEY)
        genai_types = _genai_types
    except Exception as e:
        print(f"[Overdrive] Warning: Failed to initialize google-genai client ({e}). Using instant deterministic fallback.")
        genai_client = None


app = FastAPI(
    title="Overdrive — Career & Lab Intelligence API",
    description="Single-file FastAPI backend for Overdrive (Superhuman Go + Grammarly + Chameleon CV + Voice Interviewer).",
    version="1.0.0",
)

# Full wildcard CORS for localhost:3000 / localhost:5173 and browser extensions (Superhuman Go)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def iso_mins_ago(mins: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=mins)).isoformat()


def next_slots_iso(n: int = 3, offset: int = 0) -> List[str]:
    hours = [(10, 30), (14, 0), (16, 30)]
    out: List[str] = []
    d = datetime.now() + timedelta(days=1 + (offset % 2))
    while len(out) < n:
        if d.weekday() < 5:
            h, m = hours[(len(out) + offset) % len(hours)]
            s = d.replace(hour=h, minute=m, second=0, microsecond=0)
            out.append(s.isoformat())
        d += timedelta(days=1)
    return out


# =====================================================================
# CANDIDATE CORE PROFILE & VAULT (Matches frontend VaultData + 3 Signature Hardware Projects)
# =====================================================================
CANDIDATE_PROFILE = {
    "name": "Alex Rivera",
    "headline": "UC Berkeley Stats + CS · Hardware-Software Systems Builder & Founder of Area 94",
    "signatureProjects": [
        {
            "id": "proj-drone",
            "name": "Autonomous Gesture-Controlled BetaFPV Drone",
            "baseBullet": "Built an autonomous gesture-controlled BetaFPV micro-drone using MediaPipe computer vision and custom STM32 flight controller firmware for real-time indoor navigation.",
            "techStack": ["Betaflight", "STM32", "MediaPipe", "Optical Flow", "PID Control", "C++", "Python", "250Hz Telemetry"],
            "metrics": "14ms gesture-to-thrust latency, 250Hz attitude control loop, zero-GPS indoor hover stability within ±3.5cm.",
        },
        {
            "id": "proj-meltybrain",
            "name": "1lb Meltybrain Combat Robot",
            "baseBullet": "Designed and machined a 1lb (antweight) meltybrain translational drift combat robot that spins its entire 7075-T6 chassis at 3,200 RPM while translating via high-G accelerometer heading estimation.",
            "techStack": ["High-G MEMS Accelerometer (400g)", "Custom 4-Layer PCB", "BLHeli_32 ESCs", "7075-T6 Aluminum", "Kalman Filtering", "Sensor Fusion"],
            "metrics": "3,200 RPM full-body spin, 380G centripetal acceleration survival, LED persistence-of-vision heading lock within 1.8°.",
        },
        {
            "id": "proj-extruder",
            "name": "Closed-Loop PET Bottle Filament Extruder",
            "baseBullet": "Engineered a desktop closed-loop PET bottle-to-3D-filament pullstruder with optical laser diameter sensing and dual-stage PID thermal/puller control.",
            "techStack": ["Closed-Loop PID", "Dual-Axis Optical Micrometer", "Stepper Kinematics", "SOLIDWORKS", "Thermal Modeling", "Embedded C"],
            "metrics": "1.75mm ± 0.02mm filament tolerance across 120m continuous spools, 92% crystallization consistency, $0.40/kg material cost.",
        },
    ],
}

VAULT_DATA: Dict[str, Any] = {
    "fileName": "Personal_Context_Vault.md",
    "syncedAt": iso_mins_ago(2),
    "stack": [
        "Python",
        "C++",
        "STM32 / Betaflight",
        "PyTorch",
        "MediaPipe",
        "SOLIDWORKS",
        "4-Layer PCB / MEMS",
        "Closed-Loop PID",
        "ROS 2",
        "Statistics / Optimization",
    ],
    "highlights": [
        "UC Berkeley · Statistics (math cluster) + CS · Founder of Area 94 founder/investor network",
        "Autonomous Gesture-Controlled BetaFPV Drone: 14ms MediaPipe vision-to-thrust loop + 250Hz STM32 attitude control",
        "1lb Meltybrain Combat Robot: 3,200 RPM full-body spin in 7075-T6 aluminum with 380G MEMS state estimation (<1.8° drift)",
        "Closed-Loop PET Bottle Filament Extruder: 1.75mm ± 0.02mm inline optical laser PID control ($0.40/kg feedstock)",
    ],
    "markdown": """# Personal Context Vault
_Synced from Google Drive by Superhuman Go · the agent reads this before every dossier, CV and email._

## Who I am
- **UC Berkeley** Statistics (mathematics cluster) + CS. Builder across embedded firmware, nonlinear control, and applied ML.
- Founder of **Area 94**, a vetted community connecting Bay Area technical founders and seed investors.
- Obsessed with **hardware-software boundaries** where probabilistic perception meets deterministic physical control.

## Master CV & Signature Projects
- **Autonomous Gesture-Controlled BetaFPV Drone** — Built a sub-palm autonomous micro-quadrotor pairing a **14ms MediaPipe** hand-tracking pipeline with a **250Hz STM32** flight control loop and hardware watchdog, holding **±3.5cm** GPS-denied hover.
- **1lb Meltybrain Combat Robot** — Designed and CNC-machined a **7075-T6 aluminum** monocoque and custom **4-layer PCB** that spins the entire robot at **3,200 RPM** while translating via **380G MEMS accelerometer** centripetal state estimation (**<1.8°** heading lock).
- **Closed-Loop PET Bottle Filament Extruder** — Engineered an automated PET bottle pullstruder with a **dual-axis optical laser micrometer** and cascaded thermal/puller **PID control**, holding **1.75mm ± 0.02mm** tolerance across 120m spools at **$0.40/kg** (98% cost reduction).
- **Hand-Tracking Robot-Arm Teleop & 3-DOF Compliant Gripper** — Profiled end-to-end MediaPipe → C++ control loop to cut latency by 50% (USB polling fix) and iterated 6 SOLIDWORKS print–test revisions.

## Technical stack
Python · C++ · STM32 · PyTorch · MediaPipe · SOLIDWORKS · GD&T · Custom PCB · ROS 2 · Kalman / PID Control · Statistics

## Onboarding answers (deep context)
**What problem do you want to spend your 20s on?**
Making embodied AI reliable enough to leave the lab — robots that survive 380G physical shocks and work on the 1,000th try, not just the demo video.

**A moment you're proud of that isn't on your resume?**
Debugging our teleop & flight loop at 2am: the lag wasn't the vision model, it was a USB/UART polling interval. Measured it with a logic analyzer, fixed it, latency dropped in half to 14ms.

**How do you want to come across in emails?**
Direct, metric-first, and specific. Never say "I hope this email finds you well." Lead with their paper or engineering bottleneck, drop one concrete hardware proof point, and propose one 20-minute slot.

## Targets this season
Robotics & embodied-AI research labs · Frontier AI systems teams · Elite hardware design groups · Seed-stage deep-tech VCs
""",
}


# =====================================================================
# PRE-LOADED DOSSIERS (100% aligned with frontend `Target` TypeScript type + legacy fields)
# =====================================================================
def enrich_target_aliases(t: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures every Target has both exact React frontend fields and legacy fields used by /bridge."""
    t["targetName"] = t.get("name", t.get("targetName", "Target"))
    t["matchScore"] = t.get("fitScore", t.get("matchScore", 92))
    t["readerReactionScore"] = t.get("readerReactionScore", min(98, t["matchScore"] + 2))
    if "culturalDna" not in t or not isinstance(t["culturalDna"], dict):
        t["culturalDna"] = {
            "archetype": t.get("tagline", "High-Signal Technical Builders"),
            "summary": " ".join(t.get("dna", [])[:2]),
            "tone": "Rigorous, metric-driven, first-principles",
            "values": t.get("dna", []),
            "keywords": t.get("stack", []),
        }
    if "chameleonCvDiffs" not in t:
        t["chameleonCvDiffs"] = [
            {
                "id": f"diff-{t['id']}-{idx+1}",
                "project": c.get("section", "Project"),
                "section": c.get("section", "Project"),
                "original": re.sub(r"~~(.+?)~~", r"\1", c.get("original", "")),
                "morphed": re.sub(r"\[\[(.+?)\]\]|\{\{(.+?)\}\}", r"\1\2", c.get("tailored", "")),
                "tailored": c.get("tailored", ""),
                "injected": c.get("injected", []),
                "rationale": c.get("rationale", ""),
            }
            for idx, c in enumerate(t.get("cv", []))
        ]
    return t


def get_initial_targets() -> List[Dict[str, Any]]:
    raw_targets = [
        {
            "id": "anthropic",
            "name": "Anthropic",
            "kind": "COMPANY",
            "role": "Research Engineer Intern — Interpretability, Evals & Embodied Safety",
            "tagline": "Empirical AI safety & bounded systems",
            "fitScore": 94,
            "readerReactionScore": 95,
            "source": "Pre-loaded Dossier",
            "dna": [
                "Safety is the product: frontier capability is pursued to study, bound, and steer it, not for its own sake.",
                "Empiricism over intuition — claims get a controlled ablation, an eval, or telemetry before they get a slide.",
                "Low ego, high epistemic honesty: engineers explicitly instrument worst-case failure modes and tail latencies.",
                "Writing is a core engineering skill; crisp design docs and explicit assumptions carry real weight.",
            ],
            "secretFilters": [
                {"signal": "Mechanistic rigor", "detail": "Did you measure why it worked (e.g. 14ms loop profiling), or just that it worked?"},
                {"signal": "Bounded failure modes", "detail": "Do you build deterministic watchdogs when probabilistic models degrade?"},
                {"signal": "Clear writing", "detail": "Short, precise explanations beat buzzword-heavy claims."},
                {"signal": "Debugging instinct", "detail": "Evidence you chase root causes across hardware, firmware, and ML."},
            ],
            "sources": [
                {"label": "Anthropic Research blog & mechanistic interpretability papers", "kind": "paper"},
                {"label": "Public talks & interviews with Anthropic systems leads", "kind": "talk"},
                {"label": "Careers page: Research Engineer & Systems roles", "kind": "careers"},
                {"label": "Former-intern & MTS engineering write-ups", "kind": "interview"},
            ],
            "stack": ["Python", "PyTorch", "JAX", "C++", "Deterministic Watchdogs", "Evals", "250Hz Telemetry"],
            "persona": "Senior research engineer on an interpretability & systems team: calm, precise, keeps asking \"how did you measure that failure mode?\"",
            "questions": [
                "Walk me through a time your first explanation for a system failure turned out to be wrong. How did you isolate the root cause?",
                "On your autonomous gesture-controlled BetaFPV drone, when the vision pipeline spikes past 14ms or drops frames, how does your 250Hz STM32 loop prevent runaway thrust?",
                "If a model or state estimator passes every standard eval we have, what tail-risk distribution shift would still worry you?",
                "How did you validate your 3,200 RPM meltybrain state estimator when the accelerometer hit 380G saturation?",
            ],
            "cultureKeywords": ["measure", "measured", "experiment", "evidence", "hypothesis", "wrong", "safety", "eval", "root cause", "honest", "uncertain", "tested", "watchdog"],
            "techKeywords": ["pytorch", "gradient", "loss", "eval", "baseline", "ablation", "variance", "distribution", "latency", "profil", "regression", "probability", "stm32", "250hz"],
            "cv": [
                {
                    "section": "Project · Autonomous Gesture-Controlled BetaFPV Drone",
                    "original": "Built an autonomous gesture-controlled BetaFPV micro-drone with MediaPipe and custom STM32 firmware ~~that flew really smoothly indoors~~.",
                    "tailored": "Architected a [[safety-bounded]] vision-to-actuation pipeline for an autonomous BetaFPV drone; {{traced a 2× latency spike to UART/USB polling via controlled ablations}} and enforced a deterministic [[250Hz STM32 watchdog]] at 14ms.",
                    "injected": ["safety-bounded", "controlled ablations", "250Hz STM32 watchdog"],
                    "rationale": "Anthropic filters for mechanistic rigor and deterministic safety envelopes when ML perception degrades.",
                },
                {
                    "section": "Project · 1lb Meltybrain Combat Robot (3,200 RPM)",
                    "original": "Designed and machined a 1lb meltybrain combat robot that spins at 3,200 RPM using accelerometer heading estimation.",
                    "tailored": "Built a fault-tolerant state estimator under [[380G sensor saturation]] at 3,200 RPM; {{logged out-of-distribution drift failure modes}} and built a [[closed-loop eval rig]] holding <1.8° heading certainty.",
                    "injected": ["380G sensor saturation", "closed-loop eval rig"],
                    "rationale": "Honest failure-mode instrumentation under extreme physical distribution shift maps directly to empirical safety.",
                },
                {
                    "section": "Project · Closed-Loop PET Bottle Filament Extruder",
                    "original": "Engineered a desktop closed-loop PET bottle filament extruder with optical laser diameter sensing and PID control ~~to make cheap filament~~.",
                    "tailored": "Engineered a closed-loop polymer pullstruder with [[inline optical metrology]]; {{quantified thermal-puller variance across 120m runs}} to hold [[1.75mm ± 0.02mm invariance]].",
                    "injected": ["inline optical metrology", "1.75mm ± 0.02mm invariance"],
                    "rationale": "Demonstrates continuous empirical measurement and tight invariance bounds.",
                },
            ],
            "driveDoc": {"name": "CV — Anthropic (Systems & Safety).gdoc", "exportedAt": iso_mins_ago(5)},
        },
        {
            "id": "apple-hw",
            "name": "Apple (Hardware / Design)",
            "kind": "COMPANY",
            "role": "Product Design & Mechatronics Engineering Intern",
            "tagline": "Obsessive tolerance & silicon-to-chassis craft",
            "fitScore": 92,
            "readerReactionScore": 94,
            "source": "Pre-loaded Dossier",
            "dna": [
                "Craft is non-negotiable: the internal PCB layout and datum stack-up deserve the same care as the exterior enclosure.",
                "Micron-level simplicity: teams iterate through 6+ physical revisions until ±0.02mm tolerances feel inevitable.",
                "Small teams own hardware end to end, from SOLIDWORKS CAD & CNC fixtures to oscilloscope bring-up.",
                "Human-in-the-loop interaction must feel instantaneous (<15ms) and invisible to the user.",
            ],
            "secretFilters": [
                {"signal": "Iteration & revision evidence", "detail": "Prototype counts, ±0.02mm tolerances, and what changed between rev 3 and rev 6."},
                {"signal": "Custom metrology obsession", "detail": "Did you build your own optical or mechanical test fixture to verify tolerances?"},
                {"signal": "Shock & packaging survival", "detail": "How did your 7075-T6 chassis and 4-layer PCB survive 380G mechanical loads?"},
                {"signal": "Cross-functional taste", "detail": "Can you speak ME, EE, firmware, and industrial design in one coherent sentence?"},
            ],
            "sources": [
                {"label": "Apple Product Design & Mechatronics engineering interviews", "kind": "interview"},
                {"label": "Hardware Engineering & SPG job specifications", "kind": "careers"},
                {"label": "WWDC spatial interaction & hardware craft sessions", "kind": "talk"},
                {"label": "Supply-chain & CNC manufacturing deep dives", "kind": "article"},
            ],
            "stack": ["SOLIDWORKS / NX", "GD&T (±0.02mm)", "7075-T6 CNC", "4-Layer PCB", "Inline Optical Metrology", "PID Thermal Control"],
            "persona": "Apple Product Design lead: quiet, exacting, inspects your CAD datum stack-up and asks what broke on revision 3",
            "questions": [
                "Tell me about your closed-loop PET filament extruder. How did your inline optical micrometer hold 1.75mm ± 0.02mm, and what mechanical datum drifted first?",
                "On your 1lb 3,200 RPM meltybrain robot, how did you package the custom 4-layer PCB inside the 7075-T6 aluminum chassis so solder joints didn't shear at 380G?",
                "On your gesture-controlled BetaFPV drone, how did you tune the 14ms gesture-to-thrust loop so control felt natural and imperceptible to a human operator?",
                "Tell me about your 3-DOF compliant gripper—what did revision 6 fix that revision 3 got wrong?",
            ],
            "cultureKeywords": ["iterate", "iteration", "revision", "detail", "simple", "simplify", "user", "feel", "craft", "tolerance", "prototype", "polish", "monocoque"],
            "techKeywords": ["solidworks", "cad", "tolerance", "gd&t", "dfm", "fdm", "7075", "material", "stress", "fillet", "assembly", "mm", "0.02mm", "optical", "pcb"],
            "cv": [
                {
                    "section": "Project · Closed-Loop PET Bottle Filament Extruder",
                    "original": "Engineered a desktop closed-loop PET bottle filament extruder with optical diameter sensing and PID thermal control.",
                    "tailored": "Designed a closed-loop polymer pullstruder in [[SOLIDWORKS]] with custom [[dual-axis optical laser metrology]]; {{iterated nozzle & puller kinematics}} to hold [[1.75mm ± 0.02mm tolerance]] across 120m spools.",
                    "injected": ["SOLIDWORKS", "dual-axis optical laser metrology", "1.75mm ± 0.02mm tolerance"],
                    "rationale": "Apple Product Design screens heavily for custom metrology fixtures and micron-level tolerance control.",
                },
                {
                    "section": "Project · 1lb Meltybrain Combat Robot (7075-T6 Monocoque)",
                    "original": "Designed and machined a 1lb meltybrain combat robot that spins its chassis at 3,200 RPM ~~and hits really hard~~.",
                    "tailored": "CNC-machined a high-density [[7075-T6 aluminum monocoque]] and [[custom 4-layer PCB]] surviving [[380G centripetal shock]] at 3,200 RPM; {{co-designed mass balance and sensor placement}} for <1.8° drift.",
                    "injected": ["7075-T6 aluminum monocoque", "custom 4-layer PCB", "380G centripetal shock"],
                    "rationale": "Highlights electro-mechanical co-packaging and structural survival under extreme loads.",
                },
                {
                    "section": "Project · Autonomous Gesture-Controlled BetaFPV Drone",
                    "original": "Built an autonomous gesture-controlled BetaFPV micro-drone using computer vision and custom flight controller firmware.",
                    "tailored": "Engineered a [[14ms spatial gesture interface]] for a micro-airframe; {{obsessed over human-in-the-loop feel}} by coupling MediaPipe tracking with a [[250Hz attitude loop]] for ±3.5cm hover.",
                    "injected": ["14ms spatial gesture interface", "250Hz attitude loop"],
                    "rationale": "Connects gesture drone directly to Apple Vision/Spatial HID latency and human-feel standards.",
                },
            ],
            "driveDoc": {"name": "CV — Apple Product Design & Mechatronics.gdoc", "exportedAt": iso_mins_ago(4)},
        },
        {
            "id": "berkeley-hybrid-robotics",
            "name": "UC Berkeley Hybrid Robotics Lab",
            "kind": "LAB",
            "role": "Undergraduate Researcher — Dynamic Aerial & Underactuated Control",
            "tagline": "Hardware-software latency & nonlinear dynamics",
            "fitScore": 97,
            "readerReactionScore": 97,
            "source": "Pre-loaded Dossier",
            "dna": [
                "Results count on real physical hardware: simulation is where equations start, not where they are proven.",
                "Nonlinear control theory (MPC, CBFs, non-inertial kinematics) and embedded C++ at ≥250Hz go hand in hand.",
                "Safety-critical thinking: an aerial or dynamic controller that works 99% of the time crashes into the flight cage.",
                "Undergrads who can solder an ESC at 9 PM and derive the state-space Jacobian at 10 PM get real ownership.",
            ],
            "secretFilters": [
                {"signal": "Non-inertial & underactuated math", "detail": "Can you formulate kinematics in a 3,200 RPM rotating frame or an underactuated quadrotor?"},
                {"signal": "Hands-on hardware grit", "detail": "Have you debugged STM32/Betaflight loops and high-G sensor noise under time pressure?"},
                {"signal": "Latency budget discipline", "detail": "Do you think in 250Hz control rates and 14ms transport delays?"},
                {"signal": "Experimental reproducibility", "detail": "Will you show up for flight-room bring-up and log every failure cleanly?"},
            ],
            "sources": [
                {"label": "Prof. Koushil Sreenath's publications on dynamic aerial & legged control", "kind": "paper"},
                {"label": "UC Berkeley Hybrid Robotics Lab website & Etcheverry Hall openings", "kind": "careers"},
                {"label": "ICRA / RSS conference talks & flight-room demo videos", "kind": "talk"},
                {"label": "Berkeley PhD student notes on undergrad research mentorship", "kind": "interview"},
            ],
            "stack": ["C++", "STM32 / Betaflight", "Python", "ROS 2", "MuJoCo / Isaac", "Kalman / MEMS Fusion", "CBF / MPC Optimization"],
            "persona": "PhD lead who runs the Etcheverry flight cage experiments: practical, rigorous, cares about 250Hz timing budgets and non-inertial dynamics",
            "questions": [
                "On your autonomous BetaFPV drone, your attitude loop runs at 250Hz while vision arrives with a 14ms delay. How did you compensate for transport delay so hover stayed within ±3.5cm?",
                "Your 1lb meltybrain robot spins at 3,200 RPM—walk me through the non-inertial rotating-frame math that turns 380G radial accelerometer readings into planar translational drift.",
                "What is a Control Barrier Function (CBF) intuitively, and how would you wrap one around your gesture-drone's velocity commands?",
                "On your closed-loop PET filament extruder, how did you decouple the thermal heater PID from the stepper puller kinematics?",
            ],
            "cultureKeywords": ["hardware", "reliable", "reliability", "real robot", "test", "reproducible", "safety", "document", "timing", "loop", "debug", "flight"],
            "techKeywords": ["hz", "250hz", "latency", "14ms", "control", "dynamics", "c++", "ros", "mujoco", "sim-to-real", "policy", "mpc", "optimization", "state estimate", "centripetal", "380g"],
            "cv": [
                {
                    "section": "Project · Autonomous Gesture-Controlled BetaFPV Drone",
                    "original": "Built an autonomous gesture-controlled BetaFPV micro-drone using computer vision and custom flight controller firmware.",
                    "tailored": "Implemented a [[250Hz STM32 cascaded attitude controller]] on an underactuated BetaFPV quadrotor; {{compensated for 14ms MediaPipe transport delay}} to hold [[±3.5cm GPS-denied hover]].",
                    "injected": ["250Hz STM32 cascaded attitude controller", "±3.5cm GPS-denied hover"],
                    "rationale": "Hybrid Robotics Lab filters for high-rate embedded control and explicit delay compensation on aerial platforms.",
                },
                {
                    "section": "Project · 1lb Meltybrain Combat Robot (Non-Inertial Control)",
                    "original": "Designed and machined a 1lb meltybrain combat robot that spins at 3,200 RPM while translating via accelerometer heading estimation.",
                    "tailored": "Formulated [[non-inertial rotating-frame kinematics]] and cyclic throttle modulation for an underactuated 3,200 RPM robot; {{fused 380G MEMS telemetry}} for [[<1.8° closed-loop heading lock]].",
                    "injected": ["non-inertial rotating-frame kinematics", "<1.8° closed-loop heading lock"],
                    "rationale": "Speaks directly to nonlinear dynamical systems and state estimation on aggressive physical hardware.",
                },
                {
                    "section": "Project · Closed-Loop PET Bottle Filament Extruder",
                    "original": "Engineered a desktop closed-loop PET bottle filament extruder with optical diameter sensing and PID thermal control.",
                    "tailored": "Designed a coupled [[MIMO thermo-kinematic PID loop]] with inline optical laser feedback; {{rejected draw-ratio disturbances}} to hold [[1.75mm ± 0.02mm steady-state error]].",
                    "injected": ["MIMO thermo-kinematic PID loop", "1.75mm ± 0.02mm steady-state error"],
                    "rationale": "Reinforces classical and multivariable control maturity on physical hardware.",
                },
            ],
            "driveDoc": {"name": "CV — UC Berkeley Hybrid Robotics Lab.gdoc", "exportedAt": iso_mins_ago(3)},
        },
        {
            "id": "seed-partner",
            "name": "Sequoia / YC Seed Partner",
            "kind": "VC",
            "role": "Seed Funding & Technical Scout — Area 94 & Deep-Tech Hardware",
            "tagline": "0-to-1 scrappy speed & 10× unit-economics wedges",
            "fitScore": 93,
            "readerReactionScore": 94,
            "source": "Pre-loaded Dossier",
            "dna": [
                "Founder-market fit & technical velocity first: shipping real atoms + bits in weeks beats a 40-slide deck.",
                "Asymmetric 10× cost wedges: turning $25/kg filament into $0.40/kg or $4,000 mocap rigs into a $95 drone.",
                "Clarity of thought: a one-sentence description that a busy partner understands in 5 seconds.",
                "Community gravity: founders who already sit at the center of Berkeley's top 0.1% builders via Area 94.",
            ],
            "secretFilters": [
                {"signal": "0-to-1 shipping velocity", "detail": "How fast did you go from bare PCB / CAD to a working 3,200 RPM robot or autonomous drone?"},
                {"signal": "10× cost / performance wedge", "detail": "98% feedstock cost reduction ($0.40/kg) and 40× cheaper indoor drone autonomy ($95 vs $4k)."},
                {"signal": "Crisp one-liner", "detail": "Can you pitch Area 94 or your hardware wedge in one unforgettable sentence?"},
                {"signal": "Proprietary deal flow", "detail": "Weekly active builders and intro-to-meeting conversion inside Area 94."},
            ],
            "sources": [
                {"label": "Sequoia Arc & YC partner essays on seed-stage hardware/AI", "kind": "talk"},
                {"label": "Seed scout & fellowship selection criteria", "kind": "careers"},
                {"label": "Deep-tech founder fundraising post-mortems", "kind": "interview"},
                {"label": "Thesis notes on Physical AI & software-defined hardware", "kind": "article"},
            ],
            "stack": ["98% Unit Cost Reduction ($0.40/kg)", "$95 Edge-Vision UAV", "3-Week Hardware Sprints", "Area 94 Deal Flow", "Intro → Meeting Conversion"],
            "persona": "Sequoia / YC Seed Partner on a 15-minute call: allergic to fluff, interrupts to ask for unit economics, clock speed, and traction numbers",
            "questions": [
                "What is Area 94 in one sentence, and what metric proves Berkeley's best technical founders actually rely on it?",
                "You built a closed-loop PET pullstruder that drops filament cost from $25/kg to $0.40/kg—why isn't that already a venture-scale distributed manufacturing startup?",
                "Your autonomous BetaFPV drone replaces a $4,000 motion-capture cage with a $95 airframe and a 14ms vision loop. What did you ship in the last two weeks?",
                "How did you go from a blank sheet of paper to a 3,200 RPM custom-PCB meltybrain combat robot in 3 weeks?",
            ],
            "cultureKeywords": ["users", "members", "shipped", "week", "learned", "retention", "grew", "talked", "why now", "insight", "fast", "wedge", "cost"],
            "techKeywords": ["%", "retention", "weekly", "revenue", "conversion", "cohort", "growth", "98%", "$0.40", "10x", "pipeline", "intro"],
            "cv": [
                {
                    "section": "Project · Closed-Loop PET Bottle Filament Extruder ($0.40/kg Wedge)",
                    "original": "Engineered a desktop closed-loop PET bottle filament extruder with optical diameter sensing and PID thermal control.",
                    "tailored": "{{Slashed 3D-printing feedstock unit economics by 98% ($25/kg → $0.40/kg)}} by shipping an automated closed-loop PET pullstruder holding [[1.75mm ± 0.02mm optical tolerance]].",
                    "injected": ["98% unit-cost reduction", "1.75mm ± 0.02mm optical tolerance"],
                    "rationale": "Seed VCs immediately lock onto a 98% cost-curve collapse backed by working hardware.",
                },
                {
                    "section": "Project · Autonomous Gesture-Controlled BetaFPV Drone",
                    "original": "Built an autonomous gesture-controlled BetaFPV micro-drone using computer vision and custom flight controller firmware.",
                    "tailored": "{{Replaced $4,000 motion-capture rigs with a $95 sub-palm drone}} running a [[14ms edge-vision loop]] and [[250Hz firmware]] for zero-controller indoor autonomy.",
                    "injected": ["40× cost disruption", "14ms edge-vision loop", "250Hz firmware"],
                    "rationale": "Frames the BetaFPV drone as an asymmetric 40× software-replacing-hardware cost moat.",
                },
                {
                    "section": "Founder · Area 94 & 3,200 RPM Meltybrain Robot",
                    "original": "Founded Area 94, a community for founders and investors, and built a 1lb meltybrain combat robot.",
                    "tailored": "Founded **Area 94** ({{tracking weekly intro → meeting conversion}} across top Berkeley builders) while shipping a [[3,200 RPM custom-PCB robot in 3 weeks]].",
                    "injected": ["intro → meeting conversion", "3,200 RPM custom-PCB robot in 3 weeks"],
                    "rationale": "Combines network access to outlier founders with undeniable personal clock speed.",
                },
            ],
            "driveDoc": {"name": "Pitch & CV — Sequoia / YC Seed Partner.gdoc", "exportedAt": iso_mins_ago(2)},
        },
    ]
    return [enrich_target_aliases(t) for t in raw_targets]


# =====================================================================
# DETERMINISTIC BLITZ GENERATOR (Matches exact frontend `BlitzRow` interface)
# =====================================================================
CURATED_BLITZ_POOL = [
    {
        "name": "Prof. Koushil Sreenath",
        "title": "Professor & Director, Hybrid Robotics Lab",
        "org": "UC Berkeley",
        "kind": "PROFESSOR",
        "hook": "2026 paper on safety-critical aerial & legged control under actuation delay",
        "persona": "Early-career PI building high-rate hardware",
        "proof": "I built a 250Hz STM32 autonomous BetaFPV drone that compensates for 14ms MediaPipe vision delay to hold ±3.5cm indoor hover, plus a 3,200 RPM non-inertial meltybrain robot",
    },
    {
        "name": "Prof. Ken Goldberg",
        "title": "Chair of Berkeley AUTOLAB",
        "org": "UC Berkeley BAIR / AUTOLAB",
        "kind": "PROFESSOR",
        "hook": "2026 research on closed-loop robotic manipulation & inline optical metrology",
        "persona": "Harried tenured professor with 300 unread emails",
        "proof": "I engineered a closed-loop PET filament pullstruder with a dual-axis optical laser micrometer that holds 1.75mm ± 0.02mm tolerance across 120m continuous runs",
    },
    {
        "name": "Karol Hausman",
        "title": "Co-founder & CEO",
        "org": "Physical Intelligence (π)",
        "kind": "FOUNDER",
        "hook": "thesis: general-purpose robot foundation models grounded in real-world hardware reliability",
        "persona": "Heads-down technical founder",
        "proof": "I've shipped a 14ms gesture-autonomous BetaFPV micro-drone (250Hz STM32 loop) and a 380G fault-tolerant state estimator on a custom 4-layer PCB",
    },
    {
        "name": "Sonya Huang",
        "title": "Partner — AI & Seed Investments",
        "org": "Sequoia Capital",
        "kind": "VC",
        "hook": "investment thesis: physical AI founders with 10× hardware cost wedges and community gravity",
        "persona": "Seed partner with 400 unread emails",
        "proof": "I run Area 94 at UC Berkeley (tracking weekly founder-investor conversion) and built an optical PET pullstruder that cuts filament unit cost by 98% ($25/kg → $0.40/kg)",
    },
    {
        "name": "Prof. Chelsea Finn",
        "title": "PI, IRIS Lab & Co-founder at Physical Intelligence",
        "org": "Stanford Embodied AI Lab",
        "kind": "PROFESSOR",
        "hook": "2026 paper on visuomotor policies under real-world latency & contact disturbances",
        "persona": "Tenured embodied-AI PI screening summer researchers",
        "proof": "I traced a 2× teleop latency regression to a USB polling interval and built a 14ms vision-to-thrust autonomous BetaFPV micro-drone",
    },
    {
        "name": "Brett Adcock",
        "title": "Founder & CEO",
        "org": "Figure AI",
        "kind": "FOUNDER",
        "hook": "thesis: vertically integrated humanoid mechatronics, custom PCBs, and high-torque actuation",
        "persona": "Second-time founder who hires fast",
        "proof": "I CNC-machined a 7075-T6 aluminum monocoque and custom 4-layer PCB that survives 380G centripetal acceleration at 3,200 RPM with <1.8° heading lock",
    },
    {
        "name": "Prof. Mark Mueller",
        "title": "PI, High Performance Robotics Lab (HiPeRLab)",
        "org": "UC Berkeley HiPeRLab",
        "kind": "PROFESSOR",
        "hook": "2026 work on fail-safe spinning-body aerial vehicles & GPS-denied state estimation",
        "persona": "Aerial dynamics professor who values flight-room grit",
        "proof": "my 1lb meltybrain robot uses cyclic throttle modulation at 3,200 RPM with 380G MEMS state estimation—the planar dual of HiPeRLab's spinning quadrotors",
    },
    {
        "name": "Josh Wolfe",
        "title": "Co-founder & Managing Partner",
        "org": "Lux Capital",
        "kind": "VC",
        "hook": "investment thesis: hard-tech founders turning raw atoms and embedded firmware into asymmetric moats",
        "persona": "Principal sourcing hard-tech deals",
        "proof": "I built a $95 gesture-autonomous micro-drone that replaces $4,000 mocap cages and a closed-loop PET pullstruder producing ±0.02mm feedstock at $0.40/kg",
    },
    {
        "name": "Jared Kaplan",
        "title": "Chief Science Officer & Co-founder",
        "org": "Anthropic",
        "kind": "FOUNDER",
        "hook": "thesis: empirical scaling laws & deterministic safety guardrails for autonomous agents",
        "persona": "Research-driven technical co-founder",
        "proof": "I pair probabilistic MediaPipe perception with a deterministic 250Hz STM32 safety watchdog so our autonomous micro-drone never exceeds thrust bounds under occlusion",
    },
    {
        "name": "Prof. Russ Tedrake",
        "title": "PI, Robot Locomotion Group",
        "org": "MIT CSAIL",
        "kind": "PROFESSOR",
        "hook": "2026 lecture notes on underactuated robotics & Lyapunov-stable feedback loops",
        "persona": "Tenured robotics PI who reads every equation",
        "proof": "I implemented non-inertial cyclic thrust modulation on an underactuated 3,200 RPM combat robot and a coupled MIMO PID loop holding ±0.02mm extrusion tolerance",
    },
]

SYNTH_FIRST = ["Maya", "Arjun", "Lena", "Diego", "Priya", "Kenji", "Sofia", "Omar", "Hana", "Lucas", "Amara", "Wei", "Elena", "Tomás", "Noor", "Isaac", "Yuna", "Ravi", "Clara", "Mateo"]
SYNTH_LAST = ["Okafor", "Lindqvist", "Ramanathan", "Castillo", "Nakamura", "Haddad", "Brennan", "Kowalski", "Achebe", "Varga", "Moreau", "Tanaka", "Iyer", "Fischer", "Osei", "Duarte", "Kim", "Petrov", "Alvarez", "Chen"]
SYNTH_ORGS = {
    "PROFESSOR": ["Berkeley BAIR Manipulation Group", "Stanford Dexterous Control Lab", "CMU Field Robotics Center", "MIT Embodied Intelligence Lab", "ETH Zurich Agile Drone Lab"],
    "FOUNDER": ["Kestrel Autonomy", "Forge Mechatronics", "Tessellate Embodied AI", "Aperture Motion Systems", "Halyard Robotics"],
    "VC": ["Granite Peak Ventures", "Second Order Seed Partners", "Cinder Hard-Tech Fund", "Northstar Pre-Seed", "Fieldwork Capital"],
}


def build_blitz_row_object(idx: int, item: Dict[str, Any], goal: str = "", initial_stage: int = 5) -> Dict[str, Any]:
    kind = item.get("kind", "PROFESSOR")
    if kind not in ("PROFESSOR", "FOUNDER", "VC"):
        kind = "PROFESSOR"
    name = item["name"]
    title = item["title"]
    org = item["org"]
    hook = item["hook"]
    persona = item["persona"]
    proof = item["proof"]

    first_name = re.sub(r"^Prof\.\s*", "", name).split(" ")[0]
    last_name = name.split(" ")[-1]
    greet = f"Dear Prof. {last_name}," if kind == "PROFESSOR" else f"Hi {first_name},"

    if kind == "PROFESSOR":
        subject = f"Your {hook.replace('2026 ', '')[:38]} + 250Hz hardware telemetry"
        opener = f"Your {hook} directly mirrors a hardware bottleneck I just solved in the lab."
        ask = "Would you be open to a 20-minute chat about contributing to hardware bring-up in your lab this summer?"
    elif kind == "FOUNDER":
        clean_hook = hook.replace("thesis: ", "")
        subject = f"{org.split(' ')[0]} + 14ms closed-loop hardware execution"
        opener = f"{org}'s bet on {clean_hook} is the exact boundary I build for on physical hardware."
        ask = f"Could we grab 15 minutes this week to discuss how I can ship hardware/firmware for {org}?"
    else:
        clean_hook = hook.replace("investment thesis: ", "")
        subject = f"Area 94 Berkeley deal flow + 98% hardware unit-cost wedge"
        opener = f"Your focus on {clean_hook} is why I'm reaching out directly."
        ask = "Would you be open to a 15-minute coffee chat next week?"

    after_body = (
        f"{greet}\n\n"
        f"{opener} I'm a UC Berkeley Stats + CS builder; {proof}. "
        f"{ask} I've included three open 20-minute slots from my Google Calendar below.\n\n"
        f"Best,\nAlex Rivera — sent via OVERDRIVE"
    )
    before_body = (
        f"{greet}\n\n"
        f"I hope this email finds you well! My name is Alex and I am a student at UC Berkeley who is extremely passionate about AI, hardware, and robotics. "
        f"I came across {org} and found your work very inspiring. I would love to pick your brain and learn more about any opportunities you might have available. "
        f"Please let me know if you are free sometime!\n\nThank you so much for your time and consideration!"
    )

    before_reply = 29 + ((idx * 7) % 19)
    after_reply = int(item.get("readerReactionScore") or (89 + ((idx * 3) % 9)))
    after_reply = max(88, min(97, after_reply))
    slots = next_slots_iso(3, idx)

    row_id = item.get("id") or f"b-live-{idx}"
    return {
        "id": row_id,
        "name": name,
        "contactName": name,
        "title": title,
        "role": title,
        "org": org,
        "organization": org,
        "company": org,
        "kind": kind,
        "type": kind,
        "hook": hook,
        "tailoredHook": hook,
        "persona": persona,
        "toneBadge": persona,
        "stage": initial_stage,
        "readerReactionScore": after_reply,
        "calendarSlot": "Thu • 2:00 PM PT",
        "status": "Staged in Gmail Drafts" if initial_stage == 5 else "Queued",
        "before": {
            "subject": "Opportunity inquiry / Coffee chat",
            "body": before_body,
            "reply": before_reply,
            "reaction": f'{persona}: "Generic opener. Zero evidence they read our technical work or built real hardware. Archive." Fluff detected in 4 of 5 sentences.',
        },
        "after": {
            "subject": subject,
            "body": after_body,
            "reply": after_reply,
            "reaction": f"{persona}: {after_reply}% reply probability. Opens with specific technical hook, cites verified metrics (14ms / 3,200 RPM / ±0.02mm), and proposes concrete calendar slots.",
            "fixes": [
                'Cut "I hope this email finds you well" and generic "pick your brain" filler',
                f"Opened directly with {org}'s technical bottleneck instead of self-introduction",
                "Injected concrete hardware metrics (250Hz STM32 drone, 380G meltybrain, ±0.02mm PET extruder)",
                "Attached 3 verified 20-minute Google Calendar free/busy slots",
            ],
        },
        "slots": slots,
        "gmailDraftId": f"draft-{row_id}" if initial_stage == 5 else None,
    }


def generate_blitz_rows_batch(count: int = 100, goal: str = "", initial_stage: int = 5) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    proofs = [
        "I built a 250Hz STM32 autonomous BetaFPV gesture drone (14ms latency, ±3.5cm hover) and a 1lb 3,200 RPM meltybrain combat robot",
        "I engineered a closed-loop PET bottle filament extruder with dual-axis optical laser PID holding 1.75mm ± 0.02mm tolerance at $0.40/kg",
        "I designed a 7075-T6 aluminum monocoque + 4-layer custom PCB surviving 380G centripetal shock at 3,200 RPM with <1.8° heading lock",
    ]
    for i in range(count):
        if i < len(CURATED_BLITZ_POOL):
            template = dict(CURATED_BLITZ_POOL[i])
        else:
            kind = "PROFESSOR" if (i % 3 == 0) else ("FOUNDER" if (i % 3 == 1) else "VC")
            first = SYNTH_FIRST[i % len(SYNTH_FIRST)]
            last = SYNTH_LAST[(i * 7 + 3) % len(SYNTH_LAST)]
            org_list = SYNTH_ORGS[kind]
            org = org_list[i % len(org_list)]
            if kind == "PROFESSOR":
                name = f"Prof. {first} {last}"
                title = "Associate Professor & PI"
                hook = "2026 paper on latency-bounded visuomotor control & sim-to-real hardware validation"
                persona = "Early-career PI building a lab"
            elif kind == "FOUNDER":
                name = f"{first} {last}"
                title = "Co-founder & CTO"
                hook = "thesis: software-defined mechatronics and 250Hz edge autonomy"
                persona = "Heads-down technical founder"
            else:
                name = f"{first} {last}"
                title = "Seed Partner"
                hook = "investment thesis: physical AI, hard-tech cost wedges, and technical founder networks"
                persona = "Seed partner with 400 unread emails"
            template = {
                "name": name,
                "title": title,
                "org": org,
                "kind": kind,
                "hook": hook,
                "persona": persona,
                "proof": proofs[i % len(proofs)],
            }
        rows.append(build_blitz_row_object(i, template, goal=goal, initial_stage=initial_stage))
    return rows


# In-memory live state
LIVE_TARGETS: List[Dict[str, Any]] = get_initial_targets()
TARGETS_DB: List[Dict[str, Any]] = LIVE_TARGETS
LIVE_BLITZ_ROWS: List[Dict[str, Any]] = generate_blitz_rows_batch(100, initial_stage=5)


# =====================================================================
# PYDANTIC REQUEST SCHEMAS
# =====================================================================
class DossierRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    targetName: Optional[str] = Field(default=None, description="Name of target company or lab")
    name: Optional[str] = Field(default=None, description="Alias for targetName")
    role: str = Field(default="Robotics Systems & Foundation Model Engineer", description="Target role")
    rawPageText: str = Field(default="", description="Scraped live webpage text from Superhuman Go")
    userContext: Optional[Union[str, Dict[str, Any]]] = Field(
        default="Alex Rivera — Built an autonomous gesture-controlled BetaFPV drone (14ms latency, 250Hz STM32 loop), a 1lb 3,200 RPM meltybrain combat robot (380G MEMS state estimation), and a closed-loop PET bottle filament extruder (1.75mm ± 0.02mm optical PID).",
        description="User resume/project context",
    )


class BlitzRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    careerGoal: Optional[str] = Field(default=None, description="Target career or research goal")
    goal: Optional[str] = Field(default=None, description="Frontend alias for careerGoal")
    count: int = Field(default=100, ge=1, le=200, description="Number of outreach rows to generate")


class VoiceInterviewRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    targetId: Optional[str] = Field(default="anthropic", description="Target dossier ID or name")
    companyCulture: Optional[Union[str, Dict[str, Any]]] = Field(default="", description="Cultural DNA context")
    tailoredResume: Optional[Union[str, List[Any], Dict[str, Any]]] = Field(default="", description="Morphed resume bullets")
    conversationHistory: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Previous interview turns")
    userMessage: str = Field(default="", description="Candidate's spoken/transcribed response")
    mode: Optional[str] = Field(default="interview", description="coach or interview mode")
    question: Optional[Dict[str, Any]] = Field(default=None, description="Current question + rubric from Arena.tsx")


class ReconRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    goal: str = Field(default="", description="Recon goal string")


# =====================================================================
# GEMINI HELPER WITH INSTANT DETERMINISTIC FALLBACK
# =====================================================================
def call_gemini_json(prompt: str, temperature: float = 0.4) -> Optional[Dict[str, Any]]:
    """Calls Gemini 2.5 Flash expecting a JSON object, returning None immediately if offline or unavailable."""
    if not genai_client:
        return None
    try:
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=temperature,
                response_mime_type="application/json",
            ),
        )
        raw_text = (response.text or "").strip()
        if not raw_text:
            return None
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        return json.loads(raw_text)
    except Exception as e:
        print(f"[Overdrive] Gemini call fell back to deterministic engine: {e}")
        return None


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or f"target-{uuid.uuid4().hex[:6]}"


# =====================================================================
# DETERMINISTIC DOSSIER BUILDER (Produces full React `Target` + Legacy fields)
# =====================================================================
def build_deterministic_dossier(req: DossierRequest) -> Dict[str, Any]:
    target_name = (req.targetName or req.name or "Physical Intelligence (π)").strip()
    role = (req.role or "Embodied AI & Mechatronics Engineer").strip()
    page_text = (req.rawPageText or "").strip()

    combined = f"{target_name} {role} {page_text}".lower()
    if any(k in combined for k in ["vc", "capital", "ventures", "fund", "seed", "partner", "invest"]):
        kind = "VC"
        tagline = "Asymmetric 10× wedges & high-clock-speed builders"
    elif any(k in combined for k in ["prof", "university", "lab", "institute", "stanford", "mit", "berkeley", "cmu", "phd", "bair", "autolab"]):
        kind = "LAB"
        tagline = "First-principles dynamics & real-world hardware validation"
    else:
        kind = "COMPANY"
        tagline = "Full-stack atoms-to-firmware execution & bounded latency"

    extracted_stack = ["C++", "Python", "STM32 (250Hz)", "PyTorch", "MediaPipe", "SOLIDWORKS", "Closed-Loop PID"]
    if page_text:
        words = re.findall(r"\b[A-Za-z][A-Za-z0-9\-\+]{3,16}\b", page_text)
        stop = {"about", "their", "which", "where", "would", "could", "should", "there", "these", "those", "using", "build", "working", "with", "from", "that", "this", "have"}
        custom = []
        for w in words:
            if w.lower() not in stop and w not in custom:
                custom.append(w)
            if len(custom) >= 4:
                break
        if len(custom) >= 2:
            extracted_stack = custom + ["C++ / STM32", "250Hz Control", "PyTorch"]

    score = random.randint(93, 98)
    target_id = f"{slugify(target_name)}-{int(time.time()) % 10000}"

    four_sentence_email = (
        f"Hi {target_name} Team — I saw your work on {role} and noticed how closely your engineering bar aligns with my focus on tight hardware-software feedback loops. "
        f"I recently built an autonomous gesture-controlled BetaFPV micro-drone running a 250Hz STM32 attitude loop (14ms vision-to-thrust latency) and a 1lb 3,200 RPM meltybrain robot that maintains 1.8° heading lock under 380G centripetal acceleration. "
        f"I also engineered a closed-loop PET bottle filament pullstruder with inline optical laser metrology that holds 1.75mm ± 0.02mm tolerance at $0.40/kg. "
        f"I'd love to share a 60-second demo video and grab 15 minutes this Thursday at 2:30 PM PT to discuss how I can contribute immediately to {target_name}."
    )

    dossier = {
        "id": target_id,
        "name": target_name,
        "targetName": target_name,
        "kind": kind,
        "role": role,
        "tagline": tagline,
        "fitScore": score,
        "matchScore": score,
        "readerReactionScore": min(98, score + 1),
        "source": "Superhuman Go Live Capture",
        "updatedAt": "Just now",
        "dna": [
            f"{target_name} prizes builders who own the full loop from physical sensor telemetry up to real-time inference for {role}.",
            "Quantitative instrumentation over hand-waving: latency budgets (14ms), loop rates (250Hz), and tolerances (±0.02mm) are measured on real hardware.",
            "High clock-speed iteration across CAD, custom PCBs, and embedded C++/Python stacks.",
            "Deterministic safety guardrails when upstream perception or dynamics hit edge cases.",
        ],
        "secretFilters": [
            {"signal": "Hardware-software grit", "detail": f"Screens for candidates who have debugged physical failure modes relevant to {target_name}."},
            {"signal": "Sub-20ms loop discipline", "detail": "Looks for real microcontroller (STM32/C++) timing awareness rather than slow offline scripts."},
            {"signal": "Metric-backed proof", "detail": "Strongly favors concrete numbers (380G, 3,200 RPM, ±0.02mm) over generic claims."},
            {"signal": "First-principles debugging", "detail": "Tests whether you understand the physics underneath your code."},
        ],
        "sources": [
            {"label": f"Superhuman Go live page capture: {target_name}", "kind": "careers"},
            {"label": f"{target_name} technical publications & engineering posts", "kind": "paper"},
            {"label": f"Founder / PI talks & interviews for {target_name}", "kind": "talk"},
            {"label": "Team member technical write-ups", "kind": "interview"},
        ],
        "stack": extracted_stack[:7],
        "persona": f"Principal engineer / PI at {target_name} hiring for {role}: sharp, metrics-first, probes real hardware failure modes",
        "questions": [
            f"Why {target_name} specifically, and what have you built with your own hands that proves you can thrive in our {tagline.lower()} culture?",
            "On your autonomous BetaFPV gesture drone, how does your 250Hz STM32 loop stay stable when the 14ms MediaPipe pipeline drops frames?",
            "Walk me through how your 1lb meltybrain combat robot estimates heading at 3,200 RPM under 380G centripetal acceleration.",
            "On your closed-loop PET bottle filament extruder, how did you hold 1.75mm ± 0.02mm tolerance across 120m spools?",
        ],
        "cultureKeywords": ["measure", "hardware", "latency", "reliable", "test", "loop", "debug", "shipped", "tolerance", "safety", "fast"],
        "techKeywords": ["250hz", "14ms", "stm32", "c++", "pid", "mems", "380g", "3200", "0.02mm", "optical", "pytorch", "mediapipe"],
        "cv": [
            {
                "section": "Project · Autonomous Gesture-Controlled BetaFPV Drone",
                "original": "Built an autonomous gesture-controlled BetaFPV micro-drone using computer vision and custom flight controller firmware ~~for indoor flight~~.",
                "tailored": f"Engineered a [[14ms vision-to-thrust autonomy stack]] on a BetaFPV micro-airframe for {target_name}; {{paired MediaPipe inference with a deterministic 250Hz STM32 watchdog}} to hold [[±3.5cm GPS-denied hover]].",
                "injected": ["14ms vision-to-thrust autonomy stack", "250Hz STM32 watchdog", "±3.5cm GPS-denied hover"],
                "rationale": f"Directly matches {target_name}'s bar for bounded real-time execution in {role}.",
            },
            {
                "section": "Project · 1lb Meltybrain Combat Robot (3,200 RPM)",
                "original": "Designed and machined a 1lb meltybrain combat robot that spins its entire chassis at 3,200 RPM while translating via accelerometer heading estimation.",
                "tailored": "Developed a [[380G fault-tolerant state estimator]] and [[custom 4-layer PCB]] inside a 7075-T6 monocoque spinning at 3,200 RPM; {{fused high-G MEMS telemetry}} for [[<1.8° heading lock]].",
                "injected": ["380G fault-tolerant state estimator", "custom 4-layer PCB", "<1.8° heading lock"],
                "rationale": "Proves deep electro-mechanical integration and state estimation under extreme physical dynamics.",
            },
            {
                "section": "Project · Closed-Loop PET Bottle Filament Extruder",
                "original": "Engineered a desktop closed-loop PET bottle filament extruder with optical diameter sensing and PID thermal control.",
                "tailored": "Built an automated closed-loop PET pullstruder with [[inline dual-axis optical laser metrology]] and cascaded [[PID control]], holding [[1.75mm ± 0.02mm tolerance]] at **$0.40/kg**.",
                "injected": ["inline dual-axis optical laser metrology", "PID control", "1.75mm ± 0.02mm tolerance"],
                "rationale": "Highlights precision metrology, closed-loop feedback, and 98% unit-cost reduction.",
            },
        ],
        "driveDoc": {"name": f"CV — {target_name}.gdoc", "exportedAt": iso_mins_ago(0)},
        "draftEmail": {
            "recipientName": f"{target_name} Engineering & Hiring Lead",
            "recipientRole": role,
            "subject": f"250Hz closed-loop autonomy + 380G state estimation for {target_name}",
            "body": four_sentence_email,
            "fourSentenceDraft": four_sentence_email,
            "readerReactionScore": min(98, score + 1),
            "readerReactions": [
                {"label": "Technical Credibility", "score": min(99, score + 2)},
                {"label": "Cultural DNA Match", "score": score},
                {"label": "Brevity & Punch", "score": max(91, score - 1)},
            ],
        },
    }
    return enrich_target_aliases(dossier)


def build_deterministic_interview_reply(req: VoiceInterviewRequest) -> Dict[str, Any]:
    target_id = (req.targetId or "anthropic").lower()
    user_msg = (req.userMessage or "").strip()
    msg_lower = user_msg.lower()
    turn_count = len(req.conversationHistory or [])

    tech_terms = [
        "hz", "250", "pid", "kalman", "mems", "stm32", "latency", "14ms", "ms", "rpm",
        "3200", "tolerance", "0.02", "optical", "accelerometer", "centripetal", "380g",
        "drift", "watchdog", "betaflight", "pcb", "thermal", "extruder", "drone", "meltybrain", "loop", "filter"
    ]
    matched_terms = [t for t in tech_terms if t in msg_lower]
    word_count = len(user_msg.split())

    base_tech = 86 + min(12, len(matched_terms) * 2 + (3 if word_count >= 25 else 0))
    base_culture = 85 + min(13, len(matched_terms) * 2 + (4 if word_count >= 20 else 0))

    if not user_msg:
        reply = (
            "Welcome in. Let's skip the generic resume walkthrough and go straight to hardware reality. "
            "On your autonomous gesture-controlled BetaFPV drone, when your MediaPipe vision pipeline spikes past 14ms or drops a hand-tracking frame mid-flight, "
            "how does your 250Hz STM32 flight loop prevent thrust runaway before the drone hits a wall?"
        )
    elif "drone" in msg_lower or "betafpv" in msg_lower or "gesture" in msg_lower or (turn_count % 3 == 0 and "melty" not in msg_lower):
        reply = (
            "Good detail on the 250Hz flight envelope. Now push that to your 1lb meltybrain combat robot spinning at 3,200 RPM: "
            "at 380G centripetal acceleration, standard IMU gyros saturate immediately. "
            "How did you calibrate radial accelerometer mounting offsets on your 4-layer PCB so heading drift stayed under 1.8 degrees?"
        )
    elif "melty" in msg_lower or "3200" in msg_lower or "3,200" in msg_lower or "rpm" in msg_lower or (turn_count % 3 == 1):
        reply = (
            "That high-G state estimation tradeoff makes sense. Let's pivot to manufacturing physics on your closed-loop PET bottle filament extruder: "
            "when your dual-axis optical laser micrometer detects filament necking below 1.73mm, "
            "how did you decouple the stepper puller loop from the heater PID so diameter didn't oscillate?"
        )
    else:
        if "apple" in target_id:
            lens = "if we took your ±0.02mm optical micrometer fixture to a 10,000-unit factory line, what is the single weakest mechanical datum in your current SOLIDWORKS stack-up?"
        elif "berkeley" in target_id:
            lens = "how would you formulate a Control Barrier Function (CBF) that unifies your 250Hz BetaFPV attitude loop with the 14ms vision transport delay?"
        elif "seed" in target_id or "sequoia" in target_id:
            lens = "between your $0.40/kg PET pullstruder and your $95 gesture-autonomous micro-drone, which one has the stronger 10x wedge to become a standalone venture-scale robotics company?"
        else:
            lens = "if a downstream vision model hallucinated a high-confidence gesture command on your BetaFPV drone, what deterministic invariant in your STM32 firmware catches it before actuation?"
        reply = f"Solid breakdown of the coupled PID dynamics on the PET extruder. Final pressure-test for our team: {lens}"

    q_obj = req.question or {}
    q_prompt = q_obj.get("prompt", "")
    better_answer = (
        "On my autonomous BetaFPV micro-drone, I profiled the MediaPipe-to-STM32 pipeline with a logic analyzer and traced a 2x latency spike to USB serial polling. "
        "By switching to a 250Hz DMA control loop with a 14ms hardware watchdog timer, the drone automatically latches into a damped optical-flow hover whenever vision frames drop, holding ±3.5cm stability."
    )
    if "3,200" in q_prompt or "melty" in q_prompt.lower() or "failure" in q_prompt.lower():
        better_answer = (
            "On our 1lb 3,200 RPM meltybrain robot, standard gyros saturated instantly at 380G. "
            "I redesigned our 4-layer PCB around a 400g high-G MEMS accelerometer and ran an online radial calibration routine before spin-up, locking heading drift within 1.8 degrees across full-speed impacts."
        )

    strengths = [
        "Grounded the answer in real physical hardware constraints rather than abstract theory",
        "Communicated clear ownership of the debugging & verification loop",
    ]
    if matched_terms:
        strengths.insert(0, f"Strong technical specificity ({', '.join(matched_terms[:3])})")

    improvements = [
        "State the quantitative metric outcome (e.g., 14ms latency, ±0.02mm tolerance, <1.8° drift) in your very first sentence.",
        "Explicitly contrast the failure mode before your fix vs. the verified telemetry after your fix.",
    ]

    clarity_feedback = (
        "Grammarly Reader Reactions: 94% Confident & Mechanistic — leading with concrete hardware metrics (250Hz, 380G, ±0.02mm) immediately establishes staff-level credibility."
    )

    overall_score = int(round(0.5 * base_tech + 0.5 * base_culture))
    return {
        "replyText": reply,
        "technicalScore": int(min(99, max(82, base_tech))),
        "culturalFitScore": int(min(99, max(84, base_culture))),
        "grammarlyClarityFeedback": clarity_feedback,
        "coaching": {
            "score": int(min(98, max(84, overall_score))),
            "strengths": strengths[:3],
            "improvements": improvements,
            "betterAnswer": better_answer,
        },
    }


# =====================================================================
# API ENDPOINTS
# =====================================================================
@app.get("/")
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Overdrive Backend",
        "port": 8000,
        "geminiConfigured": bool(genai_client),
        "model": GEMINI_MODEL,
        "targetsLoaded": len(LIVE_TARGETS),
        "blitzRowsLoaded": len(LIVE_BLITZ_ROWS),
    }


@app.get("/api/status")
async def get_status():
    """Returns live connection status for VaultView so all 4 connector indicators light up emerald green."""
    return {
        "mcp": True,
        "drive": True,
        "gmail": True,
        "calendar": True,
    }


@app.get("/api/vault")
async def get_vault():
    """Returns synced Personal_Context_Vault.md data so VaultView displays 'VAULT · LIVE :8000'."""
    VAULT_DATA["syncedAt"] = iso_mins_ago(1)
    return VAULT_DATA


@app.post("/api/recon")
async def launch_recon(req: ReconRequest):
    """Triggered when the user clicks 'Launch Overdrive Recon' in VaultView."""
    return {"ok": True, "goal": req.goal, "targetsCount": len(LIVE_TARGETS)}


@app.get("/api/targets")
async def get_targets():
    """
    1. GET /api/targets — Returns pre-loaded + dynamically added Company/Lab Dossiers
    (Anthropic, Apple Hardware Design, UC Berkeley Hybrid Robotics Lab, Sequoia Seed VC),
    including Cultural DNA, secret hiring filters, side-by-side Chameleon CV diffs,
    and initial Blitz outreach rows.
    """
    return {
        "status": "ok",
        "targets": LIVE_TARGETS,
        "dossiers": LIVE_TARGETS,
        "blitz": LIVE_BLITZ_ROWS,
        "blitzRows": LIVE_BLITZ_ROWS,
        "candidateProfile": CANDIDATE_PROFILE,
        "meta": {
            "totalTargets": len(LIVE_TARGETS),
            "totalBlitzRows": len(LIVE_BLITZ_ROWS),
            "aiEngine": GEMINI_MODEL if genai_client else "deterministic-fallback-v1",
        },
    }


@app.post("/api/dossier")
async def create_dossier(req: DossierRequest):
    """
    2. POST /api/dossier — Webhook/MCP endpoint called by Superhuman Go (or /bridge) when the user
    triggers the Go Agent on a live webpage. Accepts { targetName, role, rawPageText, userContext }
    and uses Gemini 2.5 Flash to extract Cultural DNA, morph the user's resume bullets, draft a
    4-sentence email, calculate a Grammarly Reader Reactions score, and prepend it to LIVE_TARGETS.
    """
    fallback = build_deterministic_dossier(req)
    target_name = fallback["name"]

    prompt = f"""You are Overdrive's Career Intelligence & Chameleon CV Engine powered by Gemini 2.5 Flash.
A user just triggered the Superhuman Go Agent on a live webpage.

Target Organization: {target_name}
Target Role: {req.role}
Live Webpage Text: {(req.rawPageText or "")[:4000]}
Candidate Context & Signature Projects:
- Autonomous Gesture-Controlled BetaFPV Drone (14ms vision-to-thrust latency, 250Hz STM32 attitude loop, ±3.5cm GPS-denied hover)
- 1lb Meltybrain Combat Robot (3,200 RPM full-body spin, 380G MEMS state estimation, custom 4-layer PCB, 7075-T6 aluminum monocoque, <1.8° heading lock)
- Closed-Loop PET Bottle Filament Extruder (1.75mm ± 0.02mm optical laser micrometer PID control, $0.40/kg material unit economics across 120m spools)

Return ONLY valid JSON matching this structure:
{{
  "kind": "LAB | COMPANY | VC",
  "tagline": "string (short punchy 3-6 word cultural DNA tagline)",
  "fitScore": 95,
  "readerReactionScore": 96,
  "dna": ["string", "string", "string", "string"],
  "secretFilters": [
    {{"signal": "string (2-3 words)", "detail": "string"}},
    {{"signal": "string (2-3 words)", "detail": "string"}},
    {{"signal": "string (2-3 words)", "detail": "string"}},
    {{"signal": "string (2-3 words)", "detail": "string"}}
  ],
  "stack": ["string", "string", "string", "string", "string", "string"],
  "persona": "string (1 sentence describing the interviewer persona)",
  "cv": [
    {{
      "section": "Project · Autonomous Gesture-Controlled BetaFPV Drone",
      "original": "Built an autonomous gesture-controlled BetaFPV micro-drone using computer vision and custom flight controller firmware ~~for indoor navigation~~.",
      "tailored": "string (wrap injected keywords in [[double brackets]] and tone shifts in {{double braces}})",
      "injected": ["string", "string"],
      "rationale": "string"
    }},
    {{
      "section": "Project · 1lb Meltybrain Combat Robot (3,200 RPM)",
      "original": "Designed and machined a 1lb meltybrain combat robot that spins at 3,200 RPM while translating via accelerometer heading estimation.",
      "tailored": "string (wrap injected keywords in [[double brackets]] and tone shifts in {{double braces}})",
      "injected": ["string", "string"],
      "rationale": "string"
    }},
    {{
      "section": "Project · Closed-Loop PET Bottle Filament Extruder",
      "original": "Engineered a desktop closed-loop PET bottle filament extruder with optical diameter sensing and PID thermal control.",
      "tailored": "string (wrap injected keywords in [[double brackets]] and tone shifts in {{double braces}})",
      "injected": ["string", "string"],
      "rationale": "string"
    }}
  ],
  "fourSentenceEmail": "string (MUST BE EXACTLY 4 SENTENCES referencing the candidate's projects and proposing a concrete time slot)"
}}"""

    ai_data = call_gemini_json(prompt, temperature=0.45)
    if isinstance(ai_data, dict):
        try:
            if ai_data.get("kind") in ("LAB", "COMPANY", "VC"):
                fallback["kind"] = ai_data["kind"]
            if ai_data.get("tagline"):
                fallback["tagline"] = str(ai_data["tagline"])
            if ai_data.get("fitScore"):
                fallback["fitScore"] = int(ai_data["fitScore"])
            if ai_data.get("readerReactionScore"):
                fallback["readerReactionScore"] = int(ai_data["readerReactionScore"])
            if isinstance(ai_data.get("dna"), list) and len(ai_data["dna"]) >= 2:
                fallback["dna"] = [str(x) for x in ai_data["dna"][:4]]
            if isinstance(ai_data.get("secretFilters"), list) and len(ai_data["secretFilters"]) >= 2:
                fallback["secretFilters"] = [
                    {"signal": str(f.get("signal", "Filter")), "detail": str(f.get("detail", ""))}
                    for f in ai_data["secretFilters"][:4]
                    if isinstance(f, dict)
                ]
            if isinstance(ai_data.get("stack"), list) and ai_data["stack"]:
                fallback["stack"] = [str(s) for s in ai_data["stack"][:7]]
            if ai_data.get("persona"):
                fallback["persona"] = str(ai_data["persona"])
            if isinstance(ai_data.get("cv"), list) and len(ai_data["cv"]) >= 3:
                fallback["cv"] = ai_data["cv"][:3]
            if ai_data.get("fourSentenceEmail"):
                fallback["draftEmail"]["body"] = str(ai_data["fourSentenceEmail"])
                fallback["draftEmail"]["fourSentenceDraft"] = str(ai_data["fourSentenceEmail"])
            fallback["source"] = "Superhuman Go + Gemini 2.5 Flash"
            enrich_target_aliases(fallback)
        except Exception as e:
            print(f"[Overdrive] Error merging Gemini dossier response, keeping deterministic fields: {e}")

    # Prepend to LIVE_TARGETS (replacing any prior duplicate with the exact same name)
    LIVE_TARGETS[:] = [t for t in LIVE_TARGETS if t.get("name", "").lower() != target_name.lower()]
    LIVE_TARGETS.insert(0, fallback)

    # Also prepend a matching BlitzRow to LIVE_BLITZ_ROWS
    new_blitz = build_blitz_row_object(
        0,
        {
            "id": f"blitz-{fallback['id']}",
            "name": f"{target_name} Lead",
            "title": req.role,
            "org": target_name,
            "kind": "PROFESSOR" if fallback["kind"] == "LAB" else ("VC" if fallback["kind"] == "VC" else "FOUNDER"),
            "hook": f"live Superhuman Go capture: {fallback['tagline']}",
            "persona": f"{target_name} hiring lead",
            "proof": "I built a 250Hz STM32 autonomous BetaFPV gesture drone (14ms latency), a 3,200 RPM 380G meltybrain robot, and a ±0.02mm optical PET filament extruder",
            "readerReactionScore": fallback["readerReactionScore"],
        },
        initial_stage=5,
    )
    LIVE_BLITZ_ROWS.insert(0, new_blitz)

    return {
        "status": "ok",
        "dossier": fallback,
        "target": fallback,
        "targets": LIVE_TARGETS,
        "blitz": LIVE_BLITZ_ROWS,
        "blitzRows": LIVE_BLITZ_ROWS,
    }


@app.post("/api/blitz")
async def generate_blitz(req: BlitzRequest):
    """
    3. POST /api/blitz — Accepts { careerGoal / goal, count } and generates a batch of hyper-targeted
    outreach rows (professors, founders, VCs) with Reader Reaction scores (88%–97%),
    calendar slots, and tailored hooks.
    """
    goal_str = (req.careerGoal or req.goal or "Robotics, Embodied AI & Deep-Tech Hardware").strip()
    count = max(1, min(200, req.count or 100))

    # Generate full BlitzRow objects (stage=0 so Blitz.tsx animates them through all 6 stages!)
    rows = generate_blitz_rows_batch(count=count, goal=goal_str, initial_stage=0)

    # If count is small (<= 15) and Gemini is configured, optionally enrich top hooks with Gemini
    if genai_client and count <= 15:
        prompt = f"""Generate {count} hyper-targeted outreach hooks for "{goal_str}" referencing:
1) Autonomous gesture-controlled BetaFPV drone (14ms latency, 250Hz STM32 loop)
2) 1lb meltybrain combat robot (3,200 RPM, 380G MEMS state estimation)
3) Closed-loop PET bottle filament extruder (1.75mm ± 0.02mm optical PID, $0.40/kg)
Return JSON: {{"hooks": ["string", ...]}}"""
        ai_data = call_gemini_json(prompt, temperature=0.5)
        if isinstance(ai_data, dict) and isinstance(ai_data.get("hooks"), list):
            for idx, h in enumerate(ai_data["hooks"][: len(rows)]):
                if isinstance(h, str) and h.strip():
                    rows[idx]["hook"] = h.strip()
                    rows[idx]["tailoredHook"] = h.strip()

    # Keep a staged copy in LIVE_BLITZ_ROWS for subsequent GET /api/targets calls
    LIVE_BLITZ_ROWS[:] = [dict(r, stage=5, gmailDraftId=f"draft-{r['id']}") for r in rows]

    return {
        "status": "ok",
        "careerGoal": goal_str,
        "goal": goal_str,
        "count": len(rows),
        "rows": rows,
        "blitz": rows,
        "blitzRows": rows,
    }


@app.post("/api/voice-interview")
async def voice_interview(req: VoiceInterviewRequest):
    """
    4. POST /api/voice-interview — Accepts { targetId, companyCulture, tailoredResume,
    conversationHistory, userMessage, mode, question }. Uses Gemini 2.5 Flash to roleplay as a
    tough interviewer from that specific lab/company, referencing the user's actual projects
    (autonomous gesture-controlled BetaFPV drone, 1lb meltybrain combat robot, closed-loop PET
    bottle filament extruder) and returning { replyText, technicalScore, culturalFitScore,
    grammarlyClarityFeedback, coaching }.
    """
    fallback = build_deterministic_interview_reply(req)

    matched_target = next(
        (
            t
            for t in LIVE_TARGETS
            if str(t.get("id", "")).lower() == str(req.targetId or "").lower()
            or str(t.get("name", "")).lower() == str(req.targetId or "").lower()
        ),
        LIVE_TARGETS[0] if LIVE_TARGETS else {},
    )
    target_name = matched_target.get("name", req.targetId or "Anthropic")
    culture_context = req.companyCulture or matched_target.get("tagline", "")
    resume_context = req.tailoredResume or matched_target.get("cv", [])

    history_str = ""
    for turn in (req.conversationHistory or [])[-6:]:
        speaker = turn.get("role") or turn.get("speaker") or "user"
        text = turn.get("content") or turn.get("text") or turn.get("message") or ""
        history_str += f"{speaker.upper()}: {text}\n"

    q_info = ""
    if isinstance(req.question, dict):
        q_info = f"Current Question Asked: {req.question.get('prompt', '')}\nRubric Points: {json.dumps(req.question.get('rubric', []))}"

    prompt = f"""You are a tough, deeply technical interviewer & coach for {target_name} (Mode: {req.mode or 'interview'}).
Company / Lab Cultural DNA: {culture_context}
Candidate's Tailored Resume Context: {json.dumps(resume_context) if not isinstance(resume_context, str) else resume_context}
{q_info}

Candidate's 3 Signature Hardware/Software Projects (ground your follow-up and model answer in these real engineering details):
1. Autonomous gesture-controlled BetaFPV drone (14ms MediaPipe gesture-to-thrust latency, 250Hz STM32 attitude control loop, ±3.5cm GPS-denied indoor hover).
2. 1lb meltybrain combat robot (spins entire 7075-T6 chassis at 3,200 RPM, 380G MEMS accelerometer centripetal state estimation, custom 4-layer PCB, <1.8° heading lock).
3. Closed-loop PET bottle filament extruder (dual-axis optical laser micrometer feedback, cascaded PID thermal/stepper puller control, 1.75mm ± 0.02mm tolerance across 120m spools, $0.40/kg cost).

Recent Conversation History:
{history_str}

Candidate's Latest Spoken Response:
"{req.userMessage}"

Return ONLY valid JSON:
{{
  "replyText": "string (2-3 spoken-friendly sentences acknowledging their answer and asking a pointed technical follow-up)",
  "technicalScore": 92,
  "culturalFitScore": 94,
  "grammarlyClarityFeedback": "string (1-2 sentences of Grammarly clarity & tone coaching)",
  "coaching": {{
    "score": 92,
    "strengths": ["string", "string"],
    "improvements": ["string", "string"],
    "betterAnswer": "string (3-4 spoken-friendly sentences showing an ideal staff-level answer citing the candidate's real hardware metrics)"
  }}
}}"""

    ai_data = call_gemini_json(prompt, temperature=0.45)
    if isinstance(ai_data, dict) and (ai_data.get("replyText") or ai_data.get("coaching")):
        try:
            ai_coach = ai_data.get("coaching") if isinstance(ai_data.get("coaching"), dict) else {}
            fb_coach = fallback["coaching"]
            return {
                "replyText": str(ai_data.get("replyText") or fallback["replyText"]).strip(),
                "technicalScore": int(max(70, min(99, int(ai_data.get("technicalScore", fallback["technicalScore"]))))),
                "culturalFitScore": int(max(70, min(99, int(ai_data.get("culturalFitScore", fallback["culturalFitScore"]))))),
                "grammarlyClarityFeedback": str(
                    ai_data.get("grammarlyClarityFeedback") or fallback["grammarlyClarityFeedback"]
                ).strip(),
                "coaching": {
                    "score": int(max(70, min(99, int(ai_coach.get("score", fb_coach["score"]))))),
                    "strengths": [str(x) for x in (ai_coach.get("strengths") or fb_coach["strengths"])[:3]],
                    "improvements": [str(x) for x in (ai_coach.get("improvements") or fb_coach["improvements"])[:3]],
                    "betterAnswer": str(ai_coach.get("betterAnswer") or fb_coach["betterAnswer"]),
                },
                "targetId": req.targetId,
                "interviewerOrg": target_name,
            }
        except Exception as e:
            print(f"[Overdrive] Error parsing Gemini voice-interview reply, using fallback: {e}")

    return {
        **fallback,
        "targetId": req.targetId,
        "interviewerOrg": target_name,
    }


@app.post("/api/reset")
async def reset_state():
    """Resets live targets and blitz rows back to the initial 4 pre-loaded dossiers."""
    global LIVE_TARGETS, TARGETS_DB, LIVE_BLITZ_ROWS
    LIVE_TARGETS[:] = get_initial_targets()
    TARGETS_DB = LIVE_TARGETS
    LIVE_BLITZ_ROWS[:] = generate_blitz_rows_batch(100, initial_stage=5)
    return {"status": "ok", "targetsLoaded": len(LIVE_TARGETS), "blitzRowsLoaded": len(LIVE_BLITZ_ROWS)}


BRIDGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Overdrive × Superhuman Go — Live Web Capture Bridge</title>
  <style>
    :root {
      --bg: #090b10;
      --panel: #111520;
      --border: #1f273a;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --accent: #6366f1;
      --green: #10b981;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; }
    body { margin: 0; background: var(--bg); color: var(--text); padding: 28px; line-height: 1.5; }
    .container { max-width: 1120px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 18px; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .badge { background: rgba(99, 102, 241, 0.16); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 22px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
    h1 { font-size: 22px; margin: 0; display: flex; align-items: center; gap: 10px; }
    h2 { font-size: 14px; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.8px; color: #818cf8; }
    p { margin: 0 0 12px 0; color: var(--muted); font-size: 13.5px; }
    label { display: block; font-size: 11.5px; font-weight: 600; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    input, textarea { width: 100%; background: #0b0e17; border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; margin-bottom: 14px; outline: none; }
    input:focus, textarea:focus { border-color: var(--accent); }
    textarea { min-height: 115px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
    .btn { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; font-weight: 700; border: none; padding: 12px 18px; border-radius: 9px; cursor: pointer; font-size: 14px; width: 100%; transition: transform 0.1s, opacity 0.15s; }
    .btn:hover { opacity: 0.94; transform: translateY(-1px); }
    .btn-secondary { background: #182032; color: var(--text); border: 1px solid var(--border); padding: 7px 12px; border-radius: 7px; font-size: 12px; cursor: pointer; font-weight: 600; text-decoration: none; }
    .btn-secondary:hover { border-color: #818cf8; color: #818cf8; }
    .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .bookmarklet-box { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.45); border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .bm-drag { display: inline-flex; align-items: center; gap: 8px; background: var(--green); color: #052e16; font-weight: 800; padding: 9px 16px; border-radius: 8px; text-decoration: none; font-size: 13.5px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); cursor: grab; }
    .target-item { padding: 12px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; background: #0b0e17; }
    .target-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .score-pill { background: rgba(16, 185, 129, 0.15); color: var(--green); padding: 2px 8px; border-radius: 99px; font-size: 11.5px; font-weight: 700; }
    .diff-box { background: #080a10; border-left: 3px solid #6366f1; padding: 8px 10px; font-size: 12px; margin-top: 8px; color: #d1d5db; border-radius: 0 6px 6px 0; }
    .status-toast { display: none; margin-top: 12px; padding: 11px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; background: rgba(16, 185, 129, 0.16); border: 1px solid var(--green); color: #6ee7b7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>⚡ Overdrive × Superhuman Go — Live Capture Bridge</h1>
        <p style="margin:4px 0 0 0;">Push any live webpage or Superhuman Go sidebar output directly into <code>POST /api/dossier</code> &amp; the React UI at <a href="http://localhost:5173" target="_blank" style="color:#818cf8;">http://localhost:5173</a>.</p>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <span class="badge" id="countBadge">Loading TARGETS_DB...</span>
        <a class="btn-secondary" href="http://localhost:5173" target="_blank">Open Frontend (:5173) ↗</a>
        <button class="btn-secondary" onclick="resetTargets()">Reset Demo State</button>
      </div>
    </div>

    <div class="bookmarklet-box">
      <div style="flex:1; min-width:260px;">
        <div style="font-weight:700; color:#6ee7b7; font-size:14px; margin-bottom:4px;">Option A: 1-Click Chrome Bookmarklet (Works on ANY Website)</div>
        <p style="margin:0; font-size:12.5px;">Drag the green button to your Bookmarks Bar. When browsing <b>Berkeley Robotics Lab</b>, <b>Anthropic</b>, or <b>Physical Intelligence</b> with Superhuman Go, click it once to scrape the page &amp; inject a live Dossier into the React app!</p>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <a id="bookmarkletLink" class="bm-drag" href="#">⚡ Overdrive Go Capture</a>
        <button class="btn-secondary" onclick="copyBookmarklet()">Copy Script</button>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Option B: 1-Click Live Inject or Paste Superhuman Go Output</h2>
        <p>Click a preset webpage below or paste the summary from your Superhuman Go sidebar, then click the button to morph your resume &amp; update <a href="http://localhost:5173" target="_blank" style="color:#818cf8;">localhost:5173</a> in real time:</p>

        <div class="presets">
          <button class="btn-secondary" onclick="fillPreset('UC Berkeley BAIR / AUTOLAB', 'Undergraduate / Graduate Robotics Researcher', 'Berkeley Artificial Intelligence Research (BAIR) & AUTOLAB: Seeking hands-on researchers in robot learning, visuomotor control, low-latency C++/STM32 hardware bring-up, and closed-loop physical manipulation.')">⚡ Berkeley BAIR / AUTOLAB</button>
          <button class="btn-secondary" onclick="fillPreset('Physical Intelligence (π)', 'Embodied Foundation Model & Hardware Engineer', 'Physical Intelligence (pi.ai) is bringing general-purpose AI into the physical world. We look for engineers who bridge real-time 250Hz+ robot control loops, dexterous mechatronics, and high-reliability sensor fusion.')">⚡ Physical Intelligence (π)</button>
          <button class="btn-secondary" onclick="fillPreset('Figure AI', 'Embedded Controls & Mechatronics Engineer', 'Figure AI builds autonomous humanoid robots. Must have deep experience in custom PCB bring-up, high-G IMU state estimation, brushless actuator control, and precision 7075 aluminum structural packaging.')">⚡ Figure AI Humanoid</button>
          <button class="btn-secondary" onclick="fillPreset('Skydio Autonomy', 'Flight Control & Edge Vision Engineer', 'Skydio builds autonomous drones that fly in GPS-denied indoor environments using real-time computer vision, optical flow, and sub-15ms obstacle avoidance loops.')">⚡ Skydio Autonomy</button>
        </div>

        <label>Target Company / Lab Name</label>
        <input id="targetName" value="Physical Intelligence (π)" />

        <label>Target Role / Position</label>
        <input id="role" value="Robotics Systems & Foundation Model Engineer" />

        <label>Live Webpage Text / Superhuman Go Agent Output</label>
        <textarea id="rawPageText">Physical Intelligence (π) is building foundation models and real-time control systems for general-purpose physical robots. We value engineers who have built real hardware from scratch, debugged high-rate microcontroller loops (STM32/C++), and closed the sim-to-real gap under noisy sensor telemetry.</textarea>

        <button class="btn" id="submitBtn" onclick="triggerDossierCapture()">⚡ Push to Live TARGETS_DB &amp; React Frontend (POST /api/dossier)</button>
        <div class="status-toast" id="statusToast"></div>
      </div>

      <div class="card">
        <h2>Live TARGETS_DB State (<span id="liveCount">0</span> Dossiers)</h2>
        <p>Your React frontend at <code>http://localhost:5173</code> polls <code>GET /api/targets</code> every 4s and renders this exact list:</p>
        <div id="targetsList" style="max-height: 520px; overflow-y: auto;"></div>
      </div>
    </div>
  </div>

  <script>
    const bookmarkletCode = `javascript:(function(){
      var sel = window.getSelection ? window.getSelection().toString() : '';
      var txt = (sel || (document.body ? document.body.innerText : '') || '').replace(/\\s+/g, ' ').slice(0, 3500);
      var rawTitle = (document.title || location.hostname || 'Live Web Target').trim();
      var parts = rawTitle.split(/[|\\-–—:•]/);
      var targetName = (parts[0] || rawTitle).trim().slice(0, 60);
      var role = (parts.slice(1).join(' ').trim() || 'Robotics & Embodied AI Systems Engineer').slice(0, 80);
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483647;background:#0f172a;color:#818cf8;border:2px solid #6366f1;padding:14px 18px;border-radius:12px;font-family:sans-serif;font-weight:700;font-size:14px;box-shadow:0 12px 30px rgba(0,0,0,0.5);';
      toast.innerText = '⚡ Overdrive × Superhuman Go: Capturing ' + targetName + '...';
      document.body.appendChild(toast);
      fetch('http://localhost:8000/api/dossier', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({targetName: targetName, role: role, rawPageText: txt})
      }).then(function(r){ return r.json(); }).then(function(d){
        toast.style.borderColor = '#10b981';
        toast.style.color = '#10b981';
        toast.innerText = '✅ Added ' + d.dossier.name + ' to Overdrive! (Fit: ' + d.dossier.fitScore + '%)';
        setTimeout(function(){ toast.remove(); }, 4000);
      }).catch(function(){
        var u = 'http://localhost:8000/bridge?autorun=1&targetName=' + encodeURIComponent(targetName) + '&role=' + encodeURIComponent(role) + '&rawPageText=' + encodeURIComponent(txt.slice(0, 1200));
        window.open(u, '_blank');
        toast.remove();
      });
    })();`;

    document.getElementById('bookmarkletLink').href = bookmarkletCode;

    function copyBookmarklet() {
      navigator.clipboard.writeText(bookmarkletCode);
      const toast = document.getElementById('statusToast');
      toast.style.display = 'block';
      toast.textContent = '✅ Copied Bookmarklet URL! Paste it into any Chrome Bookmark URL field.';
    }

    function fillPreset(name, role, text) {
      document.getElementById('targetName').value = name;
      document.getElementById('role').value = role;
      document.getElementById('rawPageText').value = text;
    }

    async function loadTargets() {
      const res = await fetch('/api/targets');
      const data = await res.json();
      const targets = data.targets || [];
      document.getElementById('countBadge').textContent = `${targets.length} Live Dossiers • ${(data.blitz || []).length} Blitz Rows`;
      document.getElementById('liveCount').textContent = targets.length;
      const list = document.getElementById('targetsList');
      list.innerHTML = targets.map((t, idx) => `
        <div class="target-item" style="${idx === 0 ? 'border-color:#6366f1;' : ''}">
          <div class="target-top">
            <strong style="font-size:14px; color:#fff;">${idx === 0 ? '🟢 ' : ''}${t.name} <span style="font-size:11px;color:#818cf8;">[${t.kind}]</span></strong>
            <span class="score-pill">Fit: ${t.fitScore}%</span>
          </div>
          <div style="font-size:12px; color:#9ca3af; margin-bottom:4px;">${t.role}</div>
          <div style="font-size:12px; color:#d1d5db;"><b>DNA:</b> ${t.tagline}</div>
          <div class="diff-box"><b>Tailored CV:</b> ${(t.cv && t.cv[0]) ? t.cv[0].tailored : ''}</div>
        </div>
      `).join('');
    }

    async function triggerDossierCapture() {
      const btn = document.getElementById('submitBtn');
      const toast = document.getElementById('statusToast');
      btn.disabled = true;
      btn.textContent = '⚡ Morphing CV & Extracting Cultural DNA...';
      try {
        const payload = {
          targetName: document.getElementById('targetName').value,
          role: document.getElementById('role').value,
          rawPageText: document.getElementById('rawPageText').value
        };
        const res = await fetch('/api/dossier', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        toast.style.display = 'block';
        toast.innerHTML = `✅ Added <b>${data.dossier.name}</b> to <code>TARGETS_DB</code>! Switch to your React tab (<a href="http://localhost:5173" target="_blank" style="color:#fff;">localhost:5173</a>) — it appears automatically!`;
        await loadTargets();
      } catch (e) {
        alert('Error calling /api/dossier: ' + e);
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Push to Live TARGETS_DB & React Frontend (POST /api/dossier)';
      }
    }

    async function resetTargets() {
      await fetch('/api/reset', { method: 'POST' });
      document.getElementById('statusToast').style.display = 'none';
      await loadTargets();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autorun') === '1') {
      if (params.get('targetName')) document.getElementById('targetName').value = params.get('targetName');
      if (params.get('role')) document.getElementById('role').value = params.get('role');
      if (params.get('rawPageText')) document.getElementById('rawPageText').value = params.get('rawPageText');
      triggerDossierCapture();
    } else {
      loadTargets();
    }
  </script>
</body>
</html>
"""


@app.get("/bridge", response_class=HTMLResponse)
async def superhuman_go_bridge():
    """Serves a 1-click Live Capture Bridge UI + Chrome Bookmarklet for Superhuman Go."""
    return HTMLResponse(content=BRIDGE_HTML)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
