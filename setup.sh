#!/usr/bin/env bash
set -euo pipefail

echo "=== MuleGuard Local Setup ==="

# Create data directories
mkdir -p data/uploads data/db data/exports

# Copy env if not exists
[ -f .env ] || cp .env.example .env

echo ""
echo "Starting MuleGuard..."
echo "This will build the Docker images and start the services."
echo "The Ollama model will be pulled on first start (~4.5GB download)."
echo ""

docker compose up -d --build

echo ""
# Pull the Ollama image in the background container
echo "Pulling qwen2.5:7b-instruct model in Ollama container..."
docker exec muleguard-ollama ollama pull qwen2.5:7b-instruct

echo "MuleGuard Local is running."
echo "- Frontend: http://localhost:8080"
echo "- API Docs: http://localhost:8000/api/docs"
echo "This application does not require, and will not use, an internet connection from this point forward."
