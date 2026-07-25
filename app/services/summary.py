from app.config import LLM_MODEL, SUPPORTED_LANGUAGES
from app.services.groq_client import get_client, with_retry

MAX_TRANSCRIPT_CHARS = 60000


def get_language_instruction(language: str) -> str:
    return (
        f"Respond in {SUPPORTED_LANGUAGES.get(language, 'the same language as the transcript')}."
        if language != "auto"
        else "Respond in the same language as the transcript."
    )


def generate_summary(transcript: str, language: str = "auto") -> str:
    client = get_client()

    text = transcript
    truncated_notice = ""
    if len(text) > MAX_TRANSCRIPT_CHARS:
        text = text[:MAX_TRANSCRIPT_CHARS]
        truncated_notice = "\n\n[Note: transcript was truncated for length.]"

    lang_instruction = get_language_instruction(language)

    system_prompt = (
        "You are an expert academic note-taker helping a university student study. "
        "Produce a structured markdown summary of the lecture transcript below. "
        "Start with a short 'Quick Recap' section (2-3 sentences), then use '## ' headings "
        "for each key topic covered, with concise bullet points ('- ') for supporting "
        "details, definitions, and examples under each heading. Be clear and well "
        f"organized. {lang_instruction}"
    )

    def _call():
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.4,
        )
        if not completion.choices:
            raise ValueError("API returned empty choices list")
        return completion.choices[0].message.content

    content = with_retry(_call)
    return (content or "").strip() + truncated_notice
