import asyncio
import logging
import time
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from threading import Thread
import torch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global model and tokenizer
model = None
tokenizer = None


class CompletionRequest(BaseModel):
    prompt: str = Field(..., description="The prompt to generate completion for")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    top_p: float = Field(0.9, ge=0.0, le=1.0, description="Nucleus sampling probability")
    top_k: int = Field(50, ge=-1, description="Top-k sampling parameter")
    max_tokens: int = Field(512, ge=1, le=2048, description="Maximum tokens to generate")
    stop: Optional[List[str]] = Field(None, description="Stop sequences")
    stream: bool = Field(False, description="Whether to stream the response")


class CompletionResponse(BaseModel):
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: system, user, or assistant")
    content: str = Field(..., description="Message content")


class ChatCompletionRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="List of messages")
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    top_p: float = Field(0.9, ge=0.0, le=1.0)
    max_tokens: int = Field(512, ge=1, le=2048)
    stop: Optional[List[str]] = None
    stream: bool = Field(False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup the model"""
    global model, tokenizer
    
    logger.info("Initializing Qwen2.5 7B model (CPU optimized)...")
    
    try:
        model_name = "Qwen/Qwen2.5-7B-Instruct-GGUF"
        quant_file = "qwen2.5-7b-instruct-q4_k_m.gguf"
        
        logger.info("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            "Qwen/Qwen2.5-7B-Instruct",
            trust_remote_code=True
        )
        
        logger.info("Loading quantized model (Q4_K_M - ~4GB)...")
        logger.info("This may take 2-3 minutes on first run...")
        
        # Use GGUF with llama.cpp backend for CPU efficiency
        try:
            from llama_cpp import Llama
            
            model = Llama(
                model_path=f"./models/{quant_file}",
                n_ctx=4096,  # Context window
                n_threads=8,  # Use all CPU threads
                n_batch=512,  # Batch size for prompt processing
                n_gpu_layers=0,  # CPU only
                use_mlock=True,  # Keep model in RAM
                verbose=False
            )
            logger.info("✅ Model loaded successfully with llama.cpp backend")
            
        except ImportError:
            logger.warning("llama-cpp-python not found, using transformers (slower)")
            
            # Fallback to transformers with 4-bit quantization
            from transformers import BitsAndBytesConfig
            
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            
            model = AutoModelForCausalLM.from_pretrained(
                "Qwen/Qwen2.5-7B-Instruct",
                quantization_config=quantization_config,
                device_map="cpu",
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )
            logger.info("✅ Model loaded with 4-bit quantization")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize model: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down model...")
    model = None
    tokenizer = None


app = FastAPI(
    title="Qwen2.5 7B Instruct LLM Service (CPU Optimized)",
    description="CPU-optimized LLM inference service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    return {
        "status": "healthy",
        "model": "Qwen2.5-7B-Instruct-Q4",
        "backend": "cpu",
        "threads": 8
    }


@app.get("/v1/models")
async def list_models():
    """List available models"""
    return {
        "object": "list",
        "data": [
            {
                "id": "Qwen2.5-7B-Instruct-Q4",
                "object": "model",
                "created": 1677610602,
                "owned_by": "qwen",
            }
        ],
    }


def generate_text(prompt: str, temperature: float, top_p: float, top_k: int, 
                  max_tokens: int, stop_sequences: List[str]) -> tuple:
    """Generate text using the model"""
    
    if hasattr(model, 'create_completion'):  # llama.cpp backend
        output = model.create_completion(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            stop=stop_sequences,
            echo=False
        )
        
        text = output['choices'][0]['text']
        prompt_tokens = output['usage']['prompt_tokens']
        completion_tokens = output['usage']['completion_tokens']
        
    else:  # transformers backend
        inputs = tokenizer(prompt, return_tensors="pt")
        prompt_tokens = inputs.input_ids.shape[1]
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        
        generated_ids = outputs[0][prompt_tokens:]
        text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        completion_tokens = len(generated_ids)
        
        # Apply stop sequences
        for stop_seq in stop_sequences:
            if stop_seq in text:
                text = text[:text.index(stop_seq)]
    
    return text, prompt_tokens, completion_tokens


@app.post("/v1/completions", response_model=CompletionResponse)
async def create_completion(request: CompletionRequest):
    """Generate text completion"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    request_id = f"cmpl-{int(time.time())}"
    created_time = int(time.time())
    
    stop_sequences = request.stop or []
    
    try:
        if request.stream:
            return StreamingResponse(
                stream_completion(
                    request.prompt,
                    request.temperature,
                    request.top_p,
                    request.top_k,
                    request.max_tokens,
                    stop_sequences,
                    request_id,
                    created_time
                ),
                media_type="text/event-stream"
            )
        
        # Non-streaming response
        text, prompt_tokens, completion_tokens = await asyncio.to_thread(
            generate_text,
            request.prompt,
            request.temperature,
            request.top_p,
            request.top_k,
            request.max_tokens,
            stop_sequences
        )
        
        return CompletionResponse(
            id=request_id,
            created=created_time,
            model="Qwen2.5-7B-Instruct-Q4",
            choices=[
                {
                    "text": text,
                    "index": 0,
                    "logprobs": None,
                    "finish_reason": "stop",
                }
            ],
            usage={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        )
        
    except Exception as e:
        logger.error(f"Error generating completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def stream_completion(prompt: str, temperature: float, top_p: float, 
                            top_k: int, max_tokens: int, stop_sequences: List[str],
                            request_id: str, created_time: int):
    """Stream completion tokens"""
    import json
    
    try:
        if hasattr(model, 'create_completion'):  # llama.cpp
            output_generator = model.create_completion(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                stop=stop_sequences,
                stream=True
            )
            
            for output in output_generator:
                if 'choices' in output and len(output['choices']) > 0:
                    text = output['choices'][0].get('text', '')
                    
                    chunk = {
                        "id": request_id,
                        "object": "text_completion.chunk",
                        "created": created_time,
                        "model": "Qwen2.5-7B-Instruct-Q4",
                        "choices": [{"text": text, "index": 0, "finish_reason": None}],
                    }
                    
                    yield f"data: {json.dumps(chunk)}\n\n"
        
        else:  # transformers
            inputs = tokenizer(prompt, return_tensors="pt")
            streamer = TextIteratorStreamer(tokenizer, skip_special_tokens=True)
            
            generation_kwargs = {
                **inputs,
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "top_k": top_k,
                "do_sample": True,
                "streamer": streamer,
            }
            
            thread = Thread(target=model.generate, kwargs=generation_kwargs)
            thread.start()
            
            for text in streamer:
                chunk = {
                    "id": request_id,
                    "object": "text_completion.chunk",
                    "created": created_time,
                    "model": "Qwen2.5-7B-Instruct-Q4",
                    "choices": [{"text": text, "index": 0, "finish_reason": None}],
                }
                
                yield f"data: {json.dumps(chunk)}\n\n"
        
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        logger.error(f"Error in streaming: {e}")
        yield f"data: {{'error': '{str(e)}'}}\n\n"


@app.post("/v1/chat/completions")
async def create_chat_completion(request: ChatCompletionRequest):
    """Generate chat completion"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    # Convert chat messages to prompt
    prompt = format_chat_prompt(request.messages)
    
    # Create completion request
    completion_request = CompletionRequest(
        prompt=prompt,
        temperature=request.temperature,
        top_p=request.top_p,
        max_tokens=request.max_tokens,
        stop=request.stop or ["<|im_end|>", "<|endoftext|>"],
        stream=request.stream,
    )
    
    return await create_completion(completion_request)


def format_chat_prompt(messages: List[ChatMessage]) -> str:
    """Format messages into Qwen2.5 chat prompt format"""
    prompt = ""
    
    for message in messages:
        role = message.role
        content = message.content
        prompt += f"<|im_start|>{role}\n{content}<|im_end|>\n"
    
    prompt += "<|im_start|>assistant\n"
    
    return prompt


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(e)},
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        workers=1,  # Single worker to save memory
    )