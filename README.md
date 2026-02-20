# GranStocks Analytics
A deterministic stock analysis web application built for cheap VPS deployments. 
Includes strict Finnhub rate limiting caching and optional Bring-Your-Own-Key (BYOK) AI narrative generation.

## Monorepo Structure
- `/server`: Fastify + Prisma (SQLite) backend.
- `/client`: React + Vite + Tailwind frontend.

## 🚀 VPS Deployment Instructions
### Prerequisites
- Node.js version 20+ installed on the VPS.
- PM2 or systemd to daemonize the node process.
- Nginx for proxy and TLS.

### 1. Installation
1. Clone this repository to `/var/www/granstocks` on your VPS.
2. Enter the server folder, copy `.env.example` to `.env` and configure your API keys. Make sure `ENCRYPTION_MASTER_KEY` is exactly 32 bytes!
3. On the VPS (with npm and node available) run the global install to generate client and server builds:
```bash
npm install
npm run build
```

### 2. Database Initialization
```bash
cd server
npx prisma migrate dev --name init
```

### 3. Running as a Service (systemd)
Copy the included `granstocks-server.service` to `/etc/systemd/system/`.
```bash
sudo cp granstocks-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable granstocks-server
sudo systemctl start granstocks-server
```

### 4. Nginx Reverse Proxy
Copy the included `granstocks-nginx.conf` snippet to the relevant sites-available block for your Nginx setup, then run `certbot --nginx` to acquire a Let's Encrypt TLS certificate.

---

## Security Architecture Guarantee
1. **Frontend Isolation**: The React bundle has a strict build-step `audit-bundle.js` script that prevents CI builds if strings like `sk-` or `api.openai` are compiled into the client.
2. **BYOK Encryption**: User AI Keys are converted to AES-256-GCM encrypted formats inside `LLMConfig` tables.
3. **API Rate Limiting**: The backend employs a token-bucket wrapper limiting outbound 60/min Finnhub limits safely to an imposed 55/minute.
