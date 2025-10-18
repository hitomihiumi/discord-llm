import os
from typing import Optional

class Settings:
    # Model configuration
    MODEL_NAME: str = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-3B-Instruct")
    MODEL_PATH: Optional[str] = os.getenv("MODEL_PATH", None)
    
    # vLLM configuration
    TENSOR_PARALLEL_SIZE: int = int(os.getenv("TENSOR_PARALLEL_SIZE", "1"))
    GPU_MEMORY_UTILIZATION: float = float(os.getenv("GPU_MEMORY_UTILIZATION", "0.9"))
    MAX_MODEL_LEN: int = int(os.getenv("MAX_MODEL_LEN", "4096"))
    
    # Quantization (optional)
    QUANTIZATION: Optional[str] = os.getenv("QUANTIZATION", None)  # "awq", "gptq", etc.
    
    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Security
    MAX_TOKENS_LIMIT: int = int(os.getenv("MAX_TOKENS_LIMIT", "4096"))
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "false").lower() == "true"
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()