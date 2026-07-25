import json

from app.config import LLM_MODEL
from app.services.groq_client import get_client, with_retry
from app.services.summary import MAX_TRANSCRIPT_CHARS, get_language_instruction


def _build_messages(transcript: str, language: str, strict: bool) -> list[dict]:
    lang_instruction = get_language_instruction(language).replace("Respond", "Write the flashcards")
    strictness = (
        " Return ONLY valid JSON, no markdown code fences, no extra commentary — just the raw JSON object."
        if strict
        else ""
    )
    system_prompt = (
        "You are an expert study-guide creator. Read the lecture transcript and produce "
        "10-20 high-quality flashcards covering the most important concepts, definitions, and facts. "
        "Follow these rules for effective active-recall learning:\n"
        "1. Ask questions, not prompts: Use 'What...?', 'Why...?', 'How...?' phrasing instead of bare terms or definitions. "
        "Example: Ask 'What is photosynthesis?' not 'Photosynthesis'.\n"
        "2. One concept per card: Split compound ideas into separate flashcards. "
        "Each card should test a single retrievable fact or idea.\n"
        "3. Avoid yes/no questions: Use open-ended questions that require the student to explain or describe.\n"
        "4. Keep both question and answer short and concrete: Do not copy long passages from the transcript. "
        "Answers should be 1-3 sentences max.\n"
        "Respond with a JSON object of the exact shape "
        '{"flashcards": [{"question": "...", "answer": "..."}, ...]}. '
        f"{lang_instruction}{strictness}"
    )
    text = transcript[:MAX_TRANSCRIPT_CHARS]
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text},
    ]


def generate_flashcards(transcript: str, language: str = "auto") -> list[dict]:
    client = get_client()

    text = transcript
    if len(text) > MAX_TRANSCRIPT_CHARS:
        text = text[:MAX_TRANSCRIPT_CHARS]

    def _call(strict: bool):
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=_build_messages(text, language, strict),
            temperature=0.5,
            response_format={"type": "json_object"},
        )
        if not completion.choices:
            raise ValueError("API returned empty choices list")
        return completion.choices[0].message.content

    raw = with_retry(lambda: _call(False))
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        raw = with_retry(lambda: _call(True))
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError) as retry_err:
            raise ValueError(f"Failed to generate valid JSON flashcards: {retry_err}") from retry_err

    cards = data.get("flashcards", [])
    return [
        {"question": str(c.get("question", "")).strip(), "answer": str(c.get("answer", "")).strip()}
        for c in cards
        if c.get("question") and c.get("answer")
    ]
