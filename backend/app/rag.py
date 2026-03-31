import os
import uuid
from typing import List
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from .config import settings

chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
embeddings = OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)

def create_collection(collection_name: str):
    return chroma_client.get_or_create_collection(name=collection_name)

def add_documents(collection_name: str, documents: List[str], metadatas: List[dict] = None):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = []
    for doc in documents:
        chunks.extend(text_splitter.split_text(doc))
    collection = chroma_client.get_collection(collection_name)
    ids = [str(uuid.uuid4()) for _ in range(len(chunks))]
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
    query_embedding = embeddings.embed_query(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents"]
    )
    return results['documents'][0] if results['documents'] else []
