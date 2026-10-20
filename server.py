import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from main import run_pipeline
from core.rag_engine import ask_question

from pathlib import Path
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


app = FastAPI(title="AI Video Assistant API")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)


# Development setup. We'll tighten this when deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stores each meeting's RAG chain for the current server process.
sessions = {}


class ProcessRequest(BaseModel):
    url: HttpUrl
    language: str = "english"


class QuestionRequest(BaseModel):
    session_id: str
    question: str


@app.get("/")
def serve_frontend():
    return FileResponse(STATIC_DIR / "index.html")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/process")
def process_video(request: ProcessRequest):
    language = request.language.lower().strip()

    if language not in {"english", "malayalam"}:
        raise HTTPException(
            status_code=400,
            detail="Language must be english or malayalam.",
        )

    try:
        result = run_pipeline(str(request.url), language)

        session_id = str(uuid.uuid4())
        sessions[session_id] = result["rag_chain"]

        return {
            "session_id": session_id,
            "title": result["title"],
            "summary": result["summary"],
            "transcript": result["transcript"],
        }

    except Exception as exc:
        print(f"Video processing failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Video processing failed. Check the backend terminal logs.",
        )


@app.post("/api/ask")
def ask_about_video(request: QuestionRequest):
    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    rag_chain = sessions.get(request.session_id)

    if rag_chain is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Process the video again.",
        )

    try:
        answer = ask_question(rag_chain, request.question.strip())
        return {"answer": answer}

    except Exception as exc:
        print(f"Question answering failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Could not answer the question. Check the backend logs.",
        )