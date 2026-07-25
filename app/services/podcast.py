import asyncio
import io
import json
import wave
from concurrent.futures import ThreadPoolExecutor

from app.config import (
    LLM_MODEL,
    PODCASTS_DIR,
    TTS_MODEL,
    TTS_VOICE_HOST_A,
    TTS_VOICE_HOST_B,
)
from app.services.groq_client import get_client, with_retry
from app.services.summary import MAX_TRANSCRIPT_CHARS, get_language_instruction

VOICE_BY_HOST = {"Host A": TTS_VOICE_HOST_A, "Host B": TTS_VOICE_HOST_B}


def generate_script(transcript: str, language: str = "auto") -> list[dict]:
    client = get_client()
    lang_instruction = get_language_instruction(language).replace("Respond", "Write the dialogue")
    system_prompt = (
        "You are a podcast scriptwriter. Turn the lecture transcript into an engaging, "
        "natural two-host conversational recap, as if two enthusiastic study-buddies are "
        "discussing what was covered. Alternate between 'Host A' and 'Host B', 6-14 short "
        "exchanges total, friendly and clear tone, highlighting the most important points. "
        'Respond with ONLY a JSON object: {"segments": [{"speaker": "Host A", "text": "..."}, '
        '{"speaker": "Host B", "text": "..."}, ...]}. '
        f"{lang_instruction}"
    )
    text = transcript[:MAX_TRANSCRIPT_CHARS]

    def _call():
        completion = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.6,
            response_format={"type": "json_object"},
        )
        if not completion.choices:
            raise ValueError("API returned empty choices list")
        return completion.choices[0].message.content

    raw = with_retry(_call)
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        raise ValueError(f"Failed to generate valid JSON podcast script: {e}") from e
    segments = data.get("segments", [])
    return [
        {"speaker": s.get("speaker", "Host A"), "text": str(s.get("text", "")).strip()}
        for s in segments
        if s.get("text")
    ]


def _synthesize_segment(client, text: str, voice: str) -> bytes:
    def _call():
        response = client.audio.speech.create(
            model=TTS_MODEL,
            voice=voice,
            input=text,
            response_format="wav",
        )
        return response.read()

    return with_retry(_call)


def _concatenate_wavs(wav_bytes_list: list[bytes]) -> tuple[bytes, float]:
    output = io.BytesIO()
    out_wave = None
    total_frames = 0
    framerate = 0

    for wav_bytes in wav_bytes_list:
        with wave.open(io.BytesIO(wav_bytes), "rb") as segment:
            if out_wave is None:
                framerate = segment.getframerate()
                out_wave = wave.open(output, "wb")
                out_wave.setnchannels(segment.getnchannels())
                out_wave.setsampwidth(segment.getsampwidth())
                out_wave.setframerate(framerate)
            frames = segment.readframes(segment.getnframes())
            out_wave.writeframes(frames)
            total_frames += segment.getnframes()

    if out_wave is not None:
        out_wave.close()

    duration = total_frames / framerate if framerate else 0.0
    return output.getvalue(), duration


def generate_podcast(lecture_id: int, transcript: str, language: str = "auto") -> dict:
    client = get_client()
    text = transcript[:MAX_TRANSCRIPT_CHARS]
    segments = generate_script(text, language)
    if not segments:
        raise ValueError("Podcast script generation returned no segments.")

    def synthesize_with_voice(segment):
        voice = VOICE_BY_HOST.get(segment["speaker"], TTS_VOICE_HOST_A)
        return _synthesize_segment(client, segment["text"], voice)

    with ThreadPoolExecutor(max_workers=4) as executor:
        audio_parts = list(executor.map(synthesize_with_voice, segments))

    combined_audio, duration = _concatenate_wavs(audio_parts)

    filename = f"lecture_{lecture_id}.wav"
    filepath = PODCASTS_DIR / filename
    filepath.write_bytes(combined_audio)

    return {
        "segments": segments,
        "audio_path": f"podcasts/{filename}",
        "duration_seconds": duration,
    }
