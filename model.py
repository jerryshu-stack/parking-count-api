"""Parking space counting backed by a local vision model via Ollama."""

import re

import ollama

MODEL = "qwen3-vl:32b"

PROMPT = "How many empty parking spaces are visible in this image?"

# qwen3-vl is a thinking model: left alone it burns thousands of tokens counting
# out loud and never reaches an answer. Prefilling the assistant turn with a
# closed <think> block and the start of the sentence forces it straight to a number.
PREFILL = "<think>\n\n</think>\n\nThe number of empty parking spaces visible is "


def count_parking_spaces(image: bytes) -> int:
    """Return the number of empty parking spaces visible in the image."""
    response = ollama.chat(
        model=MODEL,
        messages=[
            {"role": "user", "content": PROMPT, "images": [image]},
            {"role": "assistant", "content": PREFILL},
        ],
        options={"temperature": 0, "num_predict": 32},
    )
    text = response["message"]["content"]

    match = re.search(r"\d+", text)
    if not match:
        raise ValueError(f"model did not return a number: {text!r}")
    return int(match.group())
