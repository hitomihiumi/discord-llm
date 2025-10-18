#!/usr/bin/env python3
"""Download and prepare the quantized model"""

import os
from huggingface_hub import hf_hub_download

MODEL_DIR = "./models"
os.makedirs(MODEL_DIR, exist_ok=True)

print("Downloading Qwen2.5-3B-Instruct Q3_K_M quantized model...")
print("This is a ~2GB download and will take 5-10 minutes depending on your connection.")

try:
    # Download GGUF quantized model
    model_path = hf_hub_download(
        repo_id="Qwen/Qwen2.5-3B-Instruct-GGUF",
        filename="qwen2.5-3b-instruct-q3_k_m.gguf",
        local_dir=MODEL_DIR,
        local_dir_use_symlinks=False
    )
    
    print(f"✅ Model downloaded successfully to: {model_path}")
    print(f"Model size: ~4GB")
    print(f"RAM usage during inference: ~6-8GB")
    
except Exception as e:
    print(f"❌ Failed to download model: {e}")
    print("\nAlternative: Manual download")
    print("1. Visit: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF")
    print("2. Download: qwen2.5-3b-instruct-q3_k_m.gguf")
    print(f"3. Place in: {MODEL_DIR}/")
    exit(1)