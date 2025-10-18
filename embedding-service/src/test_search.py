#!/usr/bin/env python3
"""Test RAG search functionality"""

import requests
import sys

API_URL = "http://localhost:8001"


def test_search(query: str, language: str = "ru", top_k: int = 3):
    """Test search endpoint"""
    print(f"\n{'='*60}")
    print(f"Query: {query}")
    print(f"Language: {language}")
    print(f"{'='*60}\n")
    
    response = requests.post(
        f"{API_URL}/search",
        json={
            "query": query,
            "language": language,
            "top_k": top_k,
            "min_score": 0.3
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        results = data['results']
        
        if not results:
            print("No results found.")
            return
        
        for i, result in enumerate(results, 1):
            print(f"Result #{i} (Score: {result['score']:.3f})")
            print(f"Type: {result['metadata'].get('type', 'unknown')}")
            print(f"Language: {result['metadata'].get('language', 'unknown')}")
            print(f"\nContent:\n{result['content']}\n")
            print("-" * 60)
    else:
        print(f"Error: {response.status_code} - {response.text}")


def main():
    # Test Russian queries
    print("\n🇷🇺 Testing Russian queries...")
    
    test_search("Как установить Python?", "ru")
    test_search("Проблема с Discord ботом", "ru")
    test_search("Настройка окружения", "ru")
    
    # Test English queries
    print("\n🇬🇧 Testing English queries...")
    
    test_search("How to install Node.js?", "en")
    test_search("Discord bot setup", "en")
    test_search("Database connection error", "en")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        test_search(query)
    else:
        main()