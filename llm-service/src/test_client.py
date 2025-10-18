#!/usr/bin/env python3
"""Test client for LLM service"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"


def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")


def test_completion():
    """Test completion endpoint"""
    print("Testing completion endpoint...")
    
    data = {
        "prompt": "Привет! Как установить Python на Ubuntu?",
        "temperature": 0.7,
        "max_tokens": 256,
        "stop": ["Пользователь:", "User:"]
    }
    
    start = time.time()
    response = requests.post(f"{BASE_URL}/v1/completions", json=data)
    elapsed = time.time() - start
    
    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.2f}s")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Generated text: {result['choices'][0]['text']}")
        print(f"Tokens: {result['usage']}\n")
    else:
        print(f"Error: {response.text}\n")


def test_chat_completion():
    """Test chat completion endpoint"""
    print("Testing chat completion endpoint...")
    
    data = {
        "messages": [
            {"role": "system", "content": "Ты — помощник технической поддержки."},
            {"role": "user", "content": "Как создать Discord бота?"}
        ],
        "temperature": 0.7,
        "max_tokens": 300
    }
    
    start = time.time()
    response = requests.post(f"{BASE_URL}/v1/chat/completions", json=data)
    elapsed = time.time() - start
    
    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.2f}s")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Generated text: {result['choices'][0]['text']}")
        print(f"Tokens: {result['usage']}\n")
    else:
        print(f"Error: {response.text}\n")


def test_streaming():
    """Test streaming completion"""
    print("Testing streaming completion...")
    
    data = {
        "prompt": "Напиши короткую инструкцию по установке Node.js:",
        "temperature": 0.7,
        "max_tokens": 200,
        "stream": True
    }
    
    response = requests.post(
        f"{BASE_URL}/v1/completions",
        json=data,
        stream=True
    )
    
    print(f"Status: {response.status_code}")
    print("Streaming output:")
    
    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data_str = line[6:]
                if data_str != '[DONE]':
                    try:
                        chunk = json.loads(data_str)
                        print(chunk['choices'][0]['text'], end='', flush=True)
                    except json.JSONDecodeError:
                        pass
    
    print("\n")


if __name__ == "__main__":
    print("=== LLM Service Test Client ===\n")
    
    try:
        test_health()
        test_completion()
        test_chat_completion()
        test_streaming()
        
        print("✅ All tests completed!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to LLM service. Is it running?")
    except Exception as e:
        print(f"❌ Error: {e}")