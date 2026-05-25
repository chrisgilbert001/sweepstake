#!/bin/bash
# Azure App Service custom deployment script
# This runs during deployment to build the client

echo "Installing dependencies..."
npm ci --production=false

echo "Building client..."
npm run build

echo "Deployment complete!"
