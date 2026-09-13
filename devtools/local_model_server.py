"""Dev-only stand-in for the remote vision instance model.py talks to.

model.py posts a photo to REMOTE_MODEL_URL/upload and reads back `count`. That
remote is someone else's machine, so a clean checkout has nothing to call. This
serves the same contract from the Ollama + qwen3-vl already installed locally,
reusing the closed-<think> prefill that the pre-Postgres model.py used.

    .venv/bin/python devtools/local_model_server.py      # listens on 127.0.0.1:8100

Then point the API at it:

    REMOTE_MODEL_URL=http://127.0.0.1:8100 REMOTE_MODEL_API_KEY=dev ...

model.py itself is untouched -- production still talks to its configured remote.
"""

import re

import ollama
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile

MODEL = "qwen3-vl:32b"
PROMPT = "How many empty parking spaces are visible in this image?"

# qwen3-vl has no non-thinking variant on Ollama and ignores both think=False and a
# JSON schema. Left alone it spends thousands of tokens counting aloud and returns an
# empty content. Prefilling a closed <think> plus the start of the answer sentence
# forces an immediate number: ~90s -> under 2s.
PREFILL = "<think>\n\n</think>\n\nThe number of empty parking spaces visible is "

app = FastAPI()


@app.post("/upload")
async def upload(
    image: UploadFile = File(...),
    latitude: float = Form(0.0),
    longitude: float = Form(0.0),
):
    contents = await image.read()
    response = ollama.chat(
        model=MODEL,
        messages=[
            {"role": "user", "content": PROMPT, "images": [contents]},
            {"role": "assistant", "content": PREFILL},
        ],
        options={"temperature": 0, "num_predict": 32},
    )
    text = response["message"]["content"]
    match = re.search(r"\d+", text)
    if not match:
        raise ValueError(f"model did not return a number: {text!r}")
    return {"count": int(match.group())}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8100)
