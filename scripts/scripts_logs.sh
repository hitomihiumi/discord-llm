#!/bin/bash
# View logs

if [ -z "$1" ]; then
    echo "📝 Viewing all logs (Ctrl+C to exit)..."
    docker-compose logs -f
else
    echo "📝 Viewing $1 logs (Ctrl+C to exit)..."
    docker-compose logs -f $1
fi