import asyncio
import logging
import time
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global model
model = None


class CompletionRequest(BaseModel):
    prompt: str
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    top_p: float = Field(0.9, ge=0.0, le=1.0)
    top_k: int = Field(40, ge=-1)
    max_tokens: int = Field(256, ge=1, le=2048)
    stop: Optional[List[str]] = None
    stream: bool = False


class CompletionResponse(BaseModel):
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup the model"""
    global model

    logger.info("=" * 60)
    logger.info("Initializing Qwen2.5-3B with llama.cpp (FAST MODE)")
    logger.info("=" * 60)

    try:
        from llama_cpp import Llama

        model_path = "/app/models/qwen2.5-3b-instruct-q3_k_m.gguf"

        # Check file exists
        if not os.path.exists(model_path):
            logger.error(f"Model file not found: {model_path}")
            logger.info(f"Available files: {os.listdir('/app/models/')}")
            raise FileNotFoundError(f"Model not found: {model_path}")

        file_size = os.path.getsize(model_path) / 1024**3
        logger.info(f"Model file: {model_path}")
        logger.info(f"Model size: {file_size:.2f}GB")

        logger.info("Loading model with llama.cpp...")
        logger.info("This should take 30-60 seconds...")

        start = time.time()
        model = Llama(
            model_path=model_path,
            n_ctx=2048,           # Context window
            n_threads=8,          # Use all CPU cores
            n_batch=512,          # Batch size
            n_gpu_layers=0,       # CPU only
            use_mlock=False,      # Don't lock memory (может помочь на некоторых системах)
            use_mmap=True,        # Memory map для быстрой загрузки
            verbose=False,
        )

        elapsed = time.time() - start
        logger.info(f"✅ Model loaded in {elapsed:.2f}s")
        logger.info("=" * 60)
        logger.info("LLM Service is READY (llama.cpp mode)")
        logger.info("Expected speed: 8-15 tokens/second")
        logger.info("=" * 60)

    except ImportError:
        logger.error("llama-cpp-python not installed!")
        raise
    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        raise

    yield

    logger.info("Shutting down...")
    model = None


app = FastAPI(
    title="Qwen2.5 3B LLM Service (llama.cpp)",
    description="Ultra-fast CPU inference with llama.cpp",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return {
        "status": "healthy",
        "model": "Qwen2.5-3B-Instruct-Q3",
        "backend": "llama.cpp",
        "device": "cpu",
        "threads": 8
    }


@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [{
            "id": "Qwen2.5-3B-Instruct-Q3",
            "object": "model",
            "created": 1677610602,
            "owned_by": "qwen",
        }],
    }


@app.post("/v1/completions", response_model=CompletionResponse)
async def create_completion(request: CompletionRequest):
    """Generate text completion"""

    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    logger.info("=" * 60)
    logger.info(f"New request: {len(request.prompt)} chars, max_tokens={request.max_tokens}")

    request_id = f"cmpl-{int(time.time())}"
    created_time = int(time.time())
    stop_sequences = request.stop or []

    try:
        start_time = time.time()

        # Call llama.cpp
        logger.info("Generating with llama.cpp...")
        output = await asyncio.to_thread(
            model.create_completion,
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            stop=stop_sequences,
            echo=False,
        )

        elapsed = time.time() - start_time

        text = output['choices'][0]['text']
        prompt_tokens = output['usage']['prompt_tokens']
        completion_tokens = output['usage']['completion_tokens']

        tokens_per_sec = completion_tokens / elapsed if elapsed > 0 else 0

        logger.info(f"✅ Generated {completion_tokens} tokens in {elapsed:.2f}s")
        logger.info(f"⚡ Speed: {tokens_per_sec:.2f} tokens/sec")
        logger.info("=" * 60)

        return CompletionResponse(
            id=request_id,
            created=created_time,
            model="Qwen2.5-3B-Instruct-Q3",
            choices=[{
                "text": text,
                "index": 0,
                "logprobs": None,
                "finish_reason": "stop",
            }],
            usage={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        )

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/chat/completions")
async def create_chat_completion(request: dict):
    """Chat completion endpoint"""

    messages = request.get("messages", [])

    # Convert to Qwen chat format
    prompt = ""
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
    prompt += "<|im_start|>assistant\n"

    # Call completions endpoint
    completion_req = CompletionRequest(
        prompt=prompt,
        temperature=request.get("temperature", 0.7),
        max_tokens=request.get("max_tokens", 256),
        top_p=request.get("top_p", 0.9),
        stop=request.get("stop", ["<|im_end|>"]),
        stream=request.get("stream", False),
    )

    return await create_completion(completion_req)


if __name__ == "__main__":
    uvicorn.run(
        "main_llamacpp:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        workers=1,
    )