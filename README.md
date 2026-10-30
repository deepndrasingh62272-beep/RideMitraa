# RideMitra

RideMitra is a ride-sharing web application with a Next.js frontend and an Express API.

## Project layout

- `frontend/` - Next.js web application
- `backend/` - Express API and its tests

## Requirements

- Node.js 20.9 or newer
- MongoDB, locally or through a hosted MongoDB service

## Configure and run

1. Install backend dependencies and configure its environment:

   ```powershell
   cd backend
   npm ci
   Copy-Item .env.example .env
   ```

   Set at least `MONGO_URI` and a strong `JWT_SECRET` in `backend/.env`.
   Configure optional provider keys there when using maps, email/OTP,
   Cloudinary, Firebase, or AWS features.

2. In a separate terminal, install and configure the frontend:

   ```powershell
   cd frontend
   npm ci
   Copy-Item .env.example .env.local
   ```

   The example frontend URLs use the local API at `http://localhost:5000`.
   Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` when the API runs
   elsewhere.

3. Start both applications in separate terminals:

   ```powershell
   cd backend
   npm run dev
   ```

   ```powershell
   cd frontend
   npm run dev
   ```

   Open `http://localhost:3000`. The API health check is at
   `http://localhost:5000/health`.

## Validation

Run the frontend tests and production build from `frontend/`:

```powershell
npm test
npm run build
```

Run the backend tests from `backend/`:

```powershell
npm test
```

Local environment files, dependencies, logs, and build outputs are excluded
from Git. Keep credentials in local environment files or a deployment secret
manager; never commit them.
