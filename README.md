# Bitrix24 Contact Embedding Worker

A Cloudflare Worker for embedding contact information from Bitrix24 CRM into placement applications.

## Features

- 🔐 OAuth authentication with Bitrix24
- 📱 Contact placement embedding in CRM interface
- ☁️ Serverless architecture with Cloudflare Workers
- 💾 KV storage for app settings and tokens
- 🔄 Automatic token refresh handling

## Live Demo

**Cloudflare Worker**: https://bitrix24-worker.dangtinh31193.workers.dev

## Setup Instructions

### 1. Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Fill in your Bitrix24 application credentials in `.env`:
```env
BITRIX24_CLIENT_ID=local.xxxxxxxxxxxxxx.xxxxxxxx
BITRIX24_CLIENT_SECRET=your_client_secret_here
```

### 2. Cloudflare Worker Deployment

Install Wrangler CLI:
```bash
npm install -g wrangler
```

Login to Cloudflare:
```bash
wrangler login
```

Set environment variables:
```bash
wrangler secret put BITRIX24_CLIENT_ID
wrangler secret put BITRIX24_CLIENT_SECRET
```

Create KV namespace:
```bash
wrangler kv namespace create BITRIX24_SETTINGS
```

Update `wrangler.toml` with your KV namespace ID, then deploy:
```bash
wrangler deploy
```

### 3. Bitrix24 App Configuration

In your Bitrix24 Developer Console:

1. **Handler URL**: `https://your-worker.your-subdomain.workers.dev`
2. **Install URL**: `https://your-worker.your-subdomain.workers.dev/install`
3. **Placement Configuration**:
   ```json
   {
     "placements": {
       "CRM_CONTACT_DETAIL_TAB": {
         "handler": "https://your-worker.your-subdomain.workers.dev/placement",
         "title": "Contact Details"
       }
     }
   }
   ```

### 4. Installation

1. Install the app in your Bitrix24 portal
2. The app will complete OAuth flow and store credentials
3. Access contact pages in CRM to see the embedded placement

## Project Structure

```
├── worker_src/
│   ├── index.js              # Main worker entry point
│   ├── bitrix24_api.js       # Bitrix24 API integration
│   ├── wrangler.toml         # Cloudflare Worker configuration
│   ├── package.json          # Project metadata
│   └── css/
│       └── app.css           # Placement styling
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore file
└── README.md                 # This file
```

## API Endpoints

- `/` - Welcome message
- `/install` - OAuth installation endpoint
- `/placement` - Contact placement handler
- `/debug` - Debug information (development)
- `/test-settings` - Settings verification (development)

## Development

Local development with Wrangler:
```bash
cd worker_src
wrangler dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `wrangler dev`
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

---

🤖 Generated with [Claude Code](https://claude.ai/code)