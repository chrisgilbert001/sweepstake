# Deploying to Azure App Service

## Prerequisites

- Azure CLI installed (`az` command available)
- An Azure subscription with credit
- Node.js 18+ (the app uses ES modules)

## Option A: Quick Deploy with Azure CLI (Linux App Service - Recommended)

```bash
# Login to Azure
az login

# Create a resource group (pick a region close to your mates)
az group create --name sweepstake-rg --location uksouth

# Create an App Service plan (B1 is cheap, F1 is free but limited)
az appservice plan create --name sweepstake-plan --resource-group sweepstake-rg --sku B1 --is-linux

# Create the web app (Node 20 LTS)
az webapp create --resource-group sweepstake-rg --plan sweepstake-plan --name your-sweepstake-app --runtime "NODE:20-lts"

# Set the startup command
az webapp config set --resource-group sweepstake-rg --name your-sweepstake-app --startup-file "npm start"

# Configure environment variables
az webapp config appsettings set --resource-group sweepstake-rg --name your-sweepstake-app --settings \
  FOOTBALL_DATA_API_KEY=your-api-key \
  ADMIN_TOKEN=your-admin-token \
  NODE_ENV=production

# Deploy from local source (builds on Azure)
az webapp up --resource-group sweepstake-rg --name your-sweepstake-app --runtime "NODE:20-lts"
```

Your app will be available at: `https://your-sweepstake-app.azurewebsites.net`

## Option B: Deploy via GitHub Actions (CI/CD)

1. Push your repo to GitHub
2. In the Azure Portal, go to your App Service > Deployment Center
3. Select GitHub as the source
4. Azure will auto-generate a GitHub Actions workflow that builds and deploys on push

## Option C: VS Code Azure Extension

1. Install the "Azure App Service" extension in VS Code
2. Right-click the project folder > "Deploy to Web App"
3. Follow the prompts to create/select an App Service

## How It Works

- `npm run build` builds the React client into `client/dist/`
- `npm start` runs the Express server which serves both the API and the static client files
- All requests to `/api/*` hit the Express routes
- All other requests serve the React SPA (with client-side routing support)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FOOTBALL_DATA_API_KEY` | API key for football-data.org live sync |
| `ADMIN_TOKEN` | Token for admin panel access |
| `PORT` | Server port (Azure sets this automatically) |
| `NODE_ENV` | Set to `production` on Azure |

## Data Persistence

The app uses JSON files in `server/data/` for storage. On Azure App Service (Linux), the filesystem under `/home` is persistent across restarts and redeployments. The data files will survive deployments.

## Custom Domain (Optional)

```bash
# Add a custom domain
az webapp config hostname add --resource-group sweepstake-rg --webapp-name your-sweepstake-app --hostname yourdomain.com

# Enable free managed SSL
az webapp config ssl bind --resource-group sweepstake-rg --name your-sweepstake-app --certificate-thumbprint <thumbprint> --ssl-type SNI
```

Or just do it through the Azure Portal under Custom Domains — it's easier with the UI for DNS verification.
