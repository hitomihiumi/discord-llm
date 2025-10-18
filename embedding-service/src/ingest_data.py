#!/usr/bin/env python3
"""Script to ingest FAQ and tickets into the knowledge base"""

import json
import requests
import sys
from pathlib import Path

API_URL = "http://localhost:8001"


def load_dataset(dataset_path: str) -> dict:
    """Load dataset from JSON file"""
    with open(dataset_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def ingest_faqs(faqs: list) -> int:
    """Ingest FAQ entries"""
    documents = []
    
    for faq in faqs:
        doc_id = faq['id']
        question = faq['question']
        answer = faq['answer']
        language = faq.get('language', 'en')
        tags = faq.get('tags', [])
        
        # Combine question and answer for better context
        content = f"Q: {question}\nA: {answer}"
        
        documents.append({
            'id': doc_id,
            'content': content,
            'type': 'faq',
            'question': question,
            'answer': answer,
            'language': language,
            'tags': ','.join(tags)
        })
    
    # Send to API
    response = requests.post(f"{API_URL}/ingest", json={'documents': documents})
    
    if response.status_code == 200:
        return len(documents)
    else:
        raise Exception(f"Failed to ingest FAQs: {response.text}")


def ingest_tickets(tickets: list) -> int:
    """Ingest resolved ticket entries"""
    documents = []
    
    for ticket in tickets:
        doc_id = ticket['id']
        title = ticket['title']
        question = ticket['question']
        solution = ticket['solution']
        language = ticket.get('language', 'en')
        tags = ticket.get('tags', [])
        
        # Combine all text for context
        content = f"Title: {title}\nQuestion: {question}\nSolution: {solution}"
        
        documents.append({
            'id': doc_id,
            'content': content,
            'type': 'ticket',
            'title': title,
            'question': question,
            'solution': solution,
            'language': language,
            'tags': ','.join(tags)
        })
    
    # Send to API
    response = requests.post(f"{API_URL}/ingest", json={'documents': documents})
    
    if response.status_code == 200:
        return len(documents)
    else:
        raise Exception(f"Failed to ingest tickets: {response.text}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest_data.py <dataset.json>")
        sys.exit(1)
    
    dataset_path = sys.argv[1]
    
    if not Path(dataset_path).exists():
        print(f"Error: Dataset file not found: {dataset_path}")
        sys.exit(1)
    
    print(f"Loading dataset from {dataset_path}...")
    dataset = load_dataset(dataset_path)
    
    total_ingested = 0
    
    # Ingest FAQs
    if 'faqs' in dataset and dataset['faqs']:
        print(f"\nIngesting {len(dataset['faqs'])} FAQ entries...")
        count = ingest_faqs(dataset['faqs'])
        print(f"✅ Ingested {count} FAQs")
        total_ingested += count
    
    # Ingest Tickets
    if 'resolved_tickets' in dataset and dataset['resolved_tickets']:
        print(f"\nIngesting {len(dataset['resolved_tickets'])} ticket entries...")
        count = ingest_tickets(dataset['resolved_tickets'])
        print(f"✅ Ingested {count} tickets")
        total_ingested += count
    
    print(f"\n✅ Total ingested: {total_ingested} documents")
    
    # Get stats
    response = requests.get(f"{API_URL}/stats")
    if response.status_code == 200:
        stats = response.json()
        print(f"\nCollection stats:")
        print(f"  Total documents: {stats['total_documents']}")
        print(f"  By type: {stats.get('by_type', {})}")
        print(f"  By language: {stats.get('by_language', {})}")


if __name__ == "__main__":
    main()