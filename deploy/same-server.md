# Same-server backend deployment

This setup runs the existing frontend and this Fastify backend on the same VPS behind Nginx.

- Frontend stays on its current internal port, for example `127.0.0.1:8080`.
- Backend runs on `127.0.0.1:4000`.
- Nginx sends `/api/*` to the backend and everything else to the frontend.
- The backend itself is mounted at `/api/v1/*` in production.

## 1. Prepare the server

Install Node.js 20+, PostgreSQL, Nginx, and PM2 if they are not already installed:

```bash
node -v
npm -v
psql --version
nginx -v
npm install -g pm2
```

Create a Postgres database and user:

```sql
CREATE DATABASE huiscan;
CREATE USER huiscan_user WITH ENCRYPTED PASSWORD 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE huiscan TO huiscan_user;
```

## 2. Upload or clone the backend

Put the backend next to the existing frontend, not inside the frontend build directory:

```bash
sudo mkdir -p /var/www/huiscan-be
sudo chown -R $USER:$USER /var/www/huiscan-be
cd /var/www/huiscan-be
git clone <your-backend-repo-url> .
npm ci
```

If you deploy by copying files instead of Git, copy this repository to `/var/www/huiscan-be`, then run `npm ci`.

## 3. Configure environment

Create `/var/www/huiscan-be/.env`:

```env
DATABASE_URL="postgresql://huiscan_user:replace-with-a-strong-password@127.0.0.1:5432/huiscan?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
API_PREFIX="/api/v1"
NODE_ENV=production
FRONTEND_URL="https://your-domain.com"
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

## 4. Build and migrate

```bash
cd /var/www/huiscan-be
npm run db:generate
npm run build
npm run db:deploy
```

## 5. Start with PM2

Copy or use `deploy/pm2/ecosystem.config.cjs`, then update its `cwd` if your backend path is not `/var/www/huiscan-be`.

```bash
cd /var/www/huiscan-be
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

Check the backend:

```bash
pm2 logs huiscan-be
curl http://127.0.0.1:4000/api/v1/health
```

## 6. Wire Nginx without breaking the frontend

If the frontend already has an Nginx server block, add only this API location above the frontend `location /` block:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If you need a complete example, start from `deploy/nginx/huiscan-same-server.conf` and replace `your-domain.com`.

Then reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Point the frontend to the backend

For same-domain deployment, set the frontend API base URL to:

```env
VITE_BASE_URL=https://your-domain.com
```

Then rebuild and restart the frontend using its existing deployment flow.

This backend should use `API_PREFIX="/api/v1"` in production. Keep the frontend `VITE_BASE_URL` as only the domain, because the existing frontend endpoint builder appends `/api/v1`.

For example:

```txt
VITE_BASE_URL=https://your-domain.com
Final login URL=https://your-domain.com/api/v1/auth/login
```

If you later change the frontend to call `/api/auth/login` instead, switch the backend to `API_PREFIX="/api"` and update smoke tests accordingly.

## 8. Smoke test

```bash
curl https://your-domain.com/api/v1/health
curl -X POST https://your-domain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","name":"Owner","password":"password123"}'
```

Useful rollback commands:

```bash
pm2 restart huiscan-be
pm2 logs huiscan-be
sudo nginx -t
sudo systemctl reload nginx
```
