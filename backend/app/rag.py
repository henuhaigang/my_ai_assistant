import os
import uuid
import httpx
from typing import List
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .config import settings

chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

def get_embeddings():
    if settings.LLM_PROVIDER == "ollama":
        return None
    try:
        from langchain_community.embeddings import OpenAIEmbeddings
    except ImportError:
        from langchain.embeddings import OpenAIEmbeddings
    return OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)

def embed_texts_ollama(texts: List[str]) -> List[List[float]]:
    embeddings_list = []
    for text in texts:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/embeddings",
            json={"model": settings.OLLAMA_EMBEDDINGS_MODEL, "prompt": text},
            timeout=60.0
        )
        response.raise_for_status()
        embeddings_list.append(response.json()["embedding"])
    return embeddings_list

def embed_query_ollama(query: str) -> List[float]:
    response = httpx.post(
        f"{settings.OLLAMA_BASE_URL}/embeddings",
        json={"model": settings.OLLAMA_EMBEDDINGS_MODEL, "prompt": query},
        timeout=60.0
    )
    response.raise_for_status()
    return response.json()["embedding"]

def create_collection(collection_name: str):
    return chroma_client.get_or_create_collection(name=collection_name)

def add_documents(collection_name: str, documents: List[str], metadatas: List[dict] = None):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = []
    for doc in documents:
        chunks.extend(text_splitter.split_text(doc))
    collection = chroma_client.get_collection(collection_name)
    ids = [str(uuid.uuid4()) for _ in range(len(chunks))]
    
    if settings.LLM_PROVIDER == "ollama":
        embeddings_list = embed_texts_ollama(chunks)
    else:
        embeddings = get_embeddings()
        embeddings_list = embeddings.embed_documents(chunks)
    
    collection.add(
        embeddings=embeddings_list,
        documents=chunks,
        metadatas=metadatas if metadatas else [{}] * len(chunks),
        ids=ids
    )
    return len(chunks)

def search(collection_name: str, query: str, top_k: int = 3) -> List[str]:
    collection = chroma_client.get_collection(collection_name)
    
    if settings.LLM_PROVIDER == "ollama":
        query_embedding = embed_query_ollama(query)
    else:
        embeddings = get_embeddings()
        query_embedding = embeddings.embed_query(query)
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents"]
    )
    return results['documents'][0] if results['documents'] else []
