import asyncio
import logging
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
embedding_model = None
chroma_client = None
collection = None


class EmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed")


class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    usage: Dict[str, int]


class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query")
    language: str = Field("en", description="Language filter: ru or en")
    top_k: int = Field(3, ge=1, le=10, description="Number of results")
    min_score: float = Field(0.5, ge=0.0, le=1.0, description="Minimum similarity score")


class SearchResult(BaseModel):
    content: str
    score: float
    metadata: Dict[str, Any]


class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str


class IngestRequest(BaseModel):
    documents: List[Dict[str, Any]] = Field(..., description="Documents to ingest")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources"""
    global embedding_model, chroma_client, collection
    
    logger.info("Initializing Embedding Service...")
    
    try:
        # Load multilingual embedding model (optimized for CPU)
        logger.info("Loading sentence transformer model...")
        logger.info("Using paraphrase-multilingual-mpnet-base-v2 (~420MB)")
        
        embedding_model = SentenceTransformer(
            'paraphrase-multilingual-mpnet-base-v2',
            device='cpu'
        )
        
        # Optimize for CPU
        embedding_model.max_seq_length = 256  # Reduce for speed
        
        logger.info("✅ Embedding model loaded")
        
        # Initialize ChromaDB
        logger.info("Initializing ChromaDB...")
        
        chroma_client = chromadb.PersistentClient(
            path="/app/data/chroma",
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        try:
            collection = chroma_client.get_collection(name="knowledge_base")
            logger.info(f"✅ Loaded existing collection with {collection.count()} documents")
        except:
            collection = chroma_client.create_collection(
                name="knowledge_base",
                metadata={"hnsw:space": "cosine"}
            )
            logger.info("✅ Created new collection")
        
        logger.info("✅ Embedding service ready")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down embedding service...")


app = FastAPI(
    title="Embedding & RAG Service",
    description="CPU-optimized embedding and retrieval service",
    version="1.0.0",
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
    """Health check endpoint"""
    if embedding_model is None or collection is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return {
        "status": "healthy",
        "model": "paraphrase-multilingual-mpnet-base-v2",
        "documents": collection.count(),
        "backend": "cpu"
    }


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """Generate embeddings for texts"""
    if embedding_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    try:
        # Generate embeddings
        embeddings = await asyncio.to_thread(
            embedding_model.encode,
            request.texts,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        embeddings_list = embeddings.tolist()
        
        return EmbeddingResponse(
            embeddings=embeddings_list,
            model="paraphrase-multilingual-mpnet-base-v2",
            usage={
                "total_texts": len(request.texts),
                "total_tokens": sum(len(text.split()) for text in request.texts)
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Search for similar documents"""
    if embedding_model is None or collection is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Generate query embedding
        query_embedding = await asyncio.to_thread(
            embedding_model.encode,
            request.query,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        # Search in ChromaDB
        where_filter = {"language": request.language} if request.language else None
        
        results = await asyncio.to_thread(
            collection.query,
            query_embeddings=[query_embedding.tolist()],
            n_results=request.top_k,
            where=where_filter
        )
        
        # Format results
        search_results = []
        
        if results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                distance = results['distances'][0][i]
                # Convert distance to similarity score (cosine similarity)
                score = 1 - distance
                
                if score >= request.min_score:
                    search_results.append(
                        SearchResult(
                            content=results['documents'][0][i],
                            score=float(score),
                            metadata=results['metadatas'][0][i]
                        )
                    )
        
        logger.info(f"Found {len(search_results)} results for query: {request.query[:50]}...")
        
        return SearchResponse(
            results=search_results,
            query=request.query
        )
        
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest")
async def ingest_documents(request: IngestRequest):
    """Ingest documents into the knowledge base"""
    if embedding_model is None or collection is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        documents = []
        metadatas = []
        ids = []
        
        for doc in request.documents:
            if 'content' not in doc or 'id' not in doc:
                raise HTTPException(
                    status_code=400,
                    detail="Each document must have 'content' and 'id' fields"
                )
            
            documents.append(doc['content'])
            ids.append(doc['id'])
            
            # Extract metadata
            metadata = {k: v for k, v in doc.items() if k not in ['content', 'id']}
            metadatas.append(metadata)
        
        # Generate embeddings
        logger.info(f"Generating embeddings for {len(documents)} documents...")
        embeddings = await asyncio.to_thread(
            embedding_model.encode,
            documents,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        # Add to ChromaDB
        await asyncio.to_thread(
            collection.add,
            ids=ids,
            embeddings=embeddings.tolist(),
            documents=documents,
            metadatas=metadatas
        )
        
        logger.info(f"✅ Ingested {len(documents)} documents")
        
        return {
            "status": "success",
            "ingested": len(documents),
            "total_documents": collection.count()
        }
        
    except Exception as e:
        logger.error(f"Error ingesting documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document from the knowledge base"""
    if collection is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        await asyncio.to_thread(collection.delete, ids=[document_id])
        
        return {
            "status": "success",
            "deleted": document_id,
            "total_documents": collection.count()
        }
        
    except Exception as e:
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset")
async def reset_collection():
    """Reset the entire collection (use with caution!)"""
    global collection
    
    if chroma_client is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        await asyncio.to_thread(chroma_client.delete_collection, name="knowledge_base")
        
        collection = await asyncio.to_thread(
            chroma_client.create_collection,
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
        
        logger.info("✅ Collection reset")
        
        return {
            "status": "success",
            "message": "Collection reset successfully"
        }
        
    except Exception as e:
        logger.error(f"Error resetting collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats")
async def get_stats():
    """Get collection statistics"""
    if collection is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        count = collection.count()
        
        # Get sample of documents to analyze
        if count > 0:
            sample = await asyncio.to_thread(
                collection.get,
                limit=min(count, 100),
                include=["metadatas"]
            )
            
            # Count by type and language
            type_counts = {}
            language_counts = {}
            
            for metadata in sample['metadatas']:
                doc_type = metadata.get('type', 'unknown')
                language = metadata.get('language', 'unknown')
                
                type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
                language_counts[language] = language_counts.get(language, 0) + 1
            
            return {
                "total_documents": count,
                "by_type": type_counts,
                "by_language": language_counts,
                "model": "paraphrase-multilingual-mpnet-base-v2",
                "embedding_dim": 768
            }
        else:
            return {
                "total_documents": 0,
                "message": "No documents in collection"
            }
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        log_level="info",
        workers=1
    )