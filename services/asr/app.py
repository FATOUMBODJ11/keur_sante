"""
Service de reconnaissance vocale de Keur Santé.

  POST /v1/audio/transcriptions          -> français (Whisper, via faster-whisper)
  POST /v1/audio/transcriptions/wolof    -> wolof (Kiriku-Wolof-ASR, AI Hub Senegal)

Les deux routes acceptent un multipart « file » et renvoient {"text": "..."}.
L'audio est traité dans un fichier temporaire supprimé aussitôt : rien n'est conservé.

Variables d'environnement :
  WHISPER_MODEL     taille ou chemin du modèle Whisper français (défaut : small)
  WHISPER_DEVICE    cpu | cuda (défaut : cpu)
  KIRIKU_MODEL_ID   modèle wolof (défaut : AIHubSN/Kiriku-Wolof-ASR)
  KIRIKU_DEVICE     cpu | cuda (défaut : cuda si disponible)
  HF_TOKEN          jeton Hugging Face : le modèle Kiriku est en accès restreint,
                    acceptez d'abord ses conditions sur huggingface.co

Kiriku-Wolof-ASR est un Whisper large-v2 affiné pour le wolof (environ 2 milliards
de paramètres) : un GPU est fortement conseillé. Le décodage des fichiers webm/ogg
envoyés par le navigateur nécessite ffmpeg dans le PATH ; l'audio est ré-échantillonné
en 16 kHz par le pipeline.
"""

import os
import tempfile
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile

KIRIKU_DEFAULT = "AIHubSN/Kiriku-Wolof-ASR"

app = FastAPI(title="Keur Santé — ASR")


@lru_cache(maxsize=1)
def whisper():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.getenv("WHISPER_MODEL", "small"),
        device=os.getenv("WHISPER_DEVICE", "cpu"),
        compute_type="int8",
    )


@lru_cache(maxsize=1)
def kiriku():
    import torch
    from transformers import pipeline

    device = os.getenv("KIRIKU_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
    try:
        return pipeline(
            "automatic-speech-recognition",
            model=os.getenv("KIRIKU_MODEL_ID", KIRIKU_DEFAULT),
            device=device,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            token=os.getenv("HF_TOKEN") or None,
        )
    except OSError as err:
        # Modèle en accès restreint : conditions non acceptées ou jeton absent.
        raise HTTPException(
            503,
            "Impossible de charger Kiriku-Wolof-ASR. Acceptez les conditions d'accès du modèle "
            "sur huggingface.co puis définissez HF_TOKEN. Détail : " + str(err),
        ) from err


async def to_tempfile(upload: UploadFile) -> str:
    data = await upload.read()
    if not data:
        raise HTTPException(400, "Fichier audio vide")
    suffix = os.path.splitext(upload.filename or "")[1] or ".webm"
    f = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    f.write(data)
    f.close()
    return f.name


@app.get("/health")
def health():
    return {"ok": True, "kiriku_model": os.getenv("KIRIKU_MODEL_ID", KIRIKU_DEFAULT), "hf_token": bool(os.getenv("HF_TOKEN"))}


@app.post("/v1/audio/transcriptions")
async def transcribe_fr(file: UploadFile = File(...)):
    path = await to_tempfile(file)
    try:
        segments, _info = whisper().transcribe(path, language="fr", vad_filter=True)
        return {"text": " ".join(s.text.strip() for s in segments)}
    finally:
        os.unlink(path)


@app.post("/v1/audio/transcriptions/wolof")
async def transcribe_wo(file: UploadFile = File(...)):
    path = await to_tempfile(file)
    try:
        # Le wolof n'est pas une langue native de Whisper : on ne force pas de jeton de langue.
        # chunk_length_s permet de traiter des consultations de plusieurs minutes.
        out = kiriku()(path, chunk_length_s=30, return_timestamps=False)
        return {"text": out["text"].strip()}
    finally:
        os.unlink(path)
