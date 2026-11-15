"""Download the small language model the search uses to understand questions by meaning.

The search first uses its rules (keywords and phrases, in app.js). When the rules find no
measurement, the browser compares the question with the measurement descriptions using a sentence
transformer: all-MiniLM-L6-v2 (the same model as the team's Searchlight, converted to run in a web
page). Everything runs on the visitor's own computer: no account, no API key, no data sent anywhere.

This script downloads, once, the exact files the site needs (pinned versions) and checks each
file's SHA-256 fingerprint, so nobody can swap them. About 46 MB in total:
- models/all-MiniLM-L6-v2/   the model (Apache-2.0), from huggingface.co/Xenova/all-MiniLM-L6-v2
- vendor/transformers/       the code that runs it in the browser (Transformers.js 3.7.5,
                             Apache-2.0, with ONNX Runtime Web, MIT)

Run from the repository root:   python3 Website/get_search_model.py
Python standard library only. The files are committed, so the site works offline once they exist.
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9"     # Xenova/all-MiniLM-L6-v2, pinned
MODEL_URL = f"https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/{MODEL_REVISION}/"
RUNTIME_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/"

# (where it comes from, where it goes, SHA-256)
FILES = [
    (MODEL_URL + "config.json", "models/all-MiniLM-L6-v2/config.json",
     "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7"),
    (MODEL_URL + "tokenizer.json", "models/all-MiniLM-L6-v2/tokenizer.json",
     "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0"),
    (MODEL_URL + "tokenizer_config.json", "models/all-MiniLM-L6-v2/tokenizer_config.json",
     "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3"),
    (MODEL_URL + "special_tokens_map.json", "models/all-MiniLM-L6-v2/special_tokens_map.json",
     "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3"),
    (MODEL_URL + "onnx/model_quantized.onnx", "models/all-MiniLM-L6-v2/onnx/model_quantized.onnx",
     "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1"),
    (RUNTIME_URL + "dist/transformers.min.js", "vendor/transformers/transformers.min.js",
     "770f4cfc9857958f8db9c783b406b1c7f3beb3ce0c9b72776ca1e973dae9e145"),
    (RUNTIME_URL + "dist/ort-wasm-simd-threaded.jsep.mjs", "vendor/transformers/ort-wasm-simd-threaded.jsep.mjs",
     "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9"),
    (RUNTIME_URL + "dist/ort-wasm-simd-threaded.jsep.wasm", "vendor/transformers/ort-wasm-simd-threaded.jsep.wasm",
     "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39"),
    (RUNTIME_URL + "LICENSE", "vendor/transformers/LICENSE",
     "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"),
]


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    for url, target, expected in FILES:
        path = HERE / target
        if path.exists() and sha256(path) == expected:
            print(f"ok       {target}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".part")
        print(f"download {target}")
        with urllib.request.urlopen(url, timeout=120) as response, open(temporary, "wb") as out:
            while block := response.read(1 << 20):
                out.write(block)
        if sha256(temporary) != expected:
            temporary.unlink()
            sys.exit(f"SHA-256 mismatch for {target}: the file was not saved")
        temporary.replace(path)
    print("Search model ready.")


if __name__ == "__main__":
    main()
