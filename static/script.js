const videoUrlInput = document.getElementById("video-url");
const languageInput = document.getElementById("language");

const processButton = document.getElementById("process-button");
const processButtonText = document.getElementById("process-button-text");
const statusElement = document.getElementById("status");

const resultsElement = document.getElementById("results");
const titleElement = document.getElementById("video-title");
const summaryElement = document.getElementById("summary");
const transcriptElement = document.getElementById("transcript");

const questionForm = document.getElementById("question-form");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("ask-button");
const answerElement = document.getElementById("answer");

const transcriptToggle = document.getElementById("transcript-toggle");

let currentSessionId = null;


function setStatus(message, type = "") {
    statusElement.textContent = message;
    statusElement.className = "status";

    if (type) {
        statusElement.classList.add(type);
    }
}


function setProcessing(isProcessing) {
    processButton.disabled = isProcessing;
    processButtonText.textContent = isProcessing
        ? "Processing video..."
        : "Process video";
}


processButton.addEventListener("click", async () => {
    const url = videoUrlInput.value.trim();
    const language = languageInput.value;

    if (!url) {
        setStatus("Please enter a YouTube video URL.", "error");
        videoUrlInput.focus();
        return;
    }

    // Check the URL before sending it to the backend.
    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        setStatus("Please enter a valid URL.", "error");
        return;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const isYouTube =
        hostname === "youtube.com" ||
        hostname.endsWith(".youtube.com") ||
        hostname === "youtu.be" ||
        hostname.endsWith(".youtu.be");

    if (!["http:", "https:"].includes(parsedUrl.protocol) || !isYouTube) {
        setStatus("Please enter a YouTube video URL.", "error");
        return;
    }

    setProcessing(true);
    currentSessionId = null;

    resultsElement.classList.add("hidden");
    answerElement.classList.add("hidden");

    setStatus(
        "Processing your video. Audio extraction, transcription, summarization, and indexing may take a while."
    );

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: url,
                language: language
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "The backend could not process this video."
            );
        }

        currentSessionId = data.session_id;

        titleElement.textContent = data.title || "Untitled video";
        summaryElement.textContent = data.summary || "No summary returned.";
        transcriptElement.textContent =
            data.transcript || "No transcript returned.";

        resultsElement.classList.remove("hidden");

        transcriptElement.classList.add("hidden");
        transcriptToggle.textContent = "Show transcript +";
        transcriptToggle.setAttribute("aria-expanded", "false");

        setStatus("Video processed successfully!", "success");

        resultsElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error("Video processing error:", error);

        setStatus(
            error.message || "Something went wrong while processing the video.",
            "error"
        );
    } finally {
        setProcessing(false);
    }
});


questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();

    if (!currentSessionId) {
        setStatus("Process a video before asking questions.", "error");
        return;
    }

    if (!question) {
        return;
    }

    askButton.disabled = true;
    askButton.textContent = "Thinking...";
    answerElement.classList.remove("hidden");
    answerElement.textContent = "Searching the transcript and generating an answer...";

    try {
        const response = await fetch("/api/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                question: question
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Could not answer this question."
            );
        }

        answerElement.textContent = data.answer || "No answer returned.";

    } catch (error) {
        console.error("Question error:", error);
        answerElement.textContent = error.message;
    } finally {
        askButton.disabled = false;
        askButton.textContent = "Ask →";
    }
});


transcriptToggle.addEventListener("click", () => {
    const isHidden = transcriptElement.classList.contains("hidden");

    transcriptElement.classList.toggle("hidden", !isHidden);

    transcriptToggle.textContent = isHidden
        ? "Hide transcript −"
        : "Show transcript +";

    transcriptToggle.setAttribute("aria-expanded", String(isHidden));
});