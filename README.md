# TYE — Track Your Expenses

Full-stack expense tracker with a **FastAPI** backend and **React** frontend.  
Supports Google OAuth login, budget tracking, monthly reports, and AI-powered receipt OCR (Bengali + English).

---

## Project Structure

```
TYE-Clean/
├── backend/
│   ├── app/                 # FastAPI source code
│   │   ├── main.py          #   API routes
│   │   ├── models.py        #   Database models (SQLAlchemy)
│   │   ├── schemas.py       #   Pydantic request/response schemas
│   │   ├── database.py      #   DB connection (reads from .env)
│   │   ├── ocr_service.py   #   Google Cloud Vision OCR
│   │   ├── parser_service.py#   Receipt text parser
│   │   └── uploads/         #   Uploaded receipt images (gitignored)
│   ├── migrations/          # Database migration scripts
│   ├── tests/               # 52 pytest tests
│   ├── requirements.txt
│   └── .env.example         # ← copy to .env and fill in your secrets
├── frontend/
│   ├── src/
│   │   ├── pages/           #   LandingPage, LoginPage, Dashboard
│   │   ├── components/      #   ParticleCanvas
│   │   └── hooks/           #   useApi.js
│   ├── public/
│   ├── tests/               # 32 Vitest tests
│   ├── .env.example         # ← copy to .env and fill in your secrets
│   └── package.json
├── docs/                    # Project reports and documentation
├── docker-compose.yml
└── README.md
```

---

## Quick Setup

### 1. Backend

```bash
cd backend

# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your real values (DB password, API keys, etc.)

# Create database tables (first time only)
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"

# Start the API server (run from backend/ folder)
cd app
uvicorn main:app --reload
# → API:       http://127.0.0.1:8000
# → Swagger UI: http://127.0.0.1:8000/docs
```

### 2. Frontend

```bash
cd frontend

# Set up environment variables
cp .env.example .env
# Edit .env with your Google Client ID

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
# → http://localhost:5173
```

---

## Environment Variables

> ⚠️ **Never commit `.env` files.** They are listed in `.gitignore`.

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:PASSWORD@localhost/tye_db` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID from [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_VISION_API_KEY` | Google Cloud Vision API key (for OCR receipt scanning) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth Client ID as backend |
| `VITE_API_URL` | Backend URL (default: `http://127.0.0.1:8000`) |

---

## Google Services Setup (One-time)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Cloud Vision API** (for OCR)
3. Create an **API Key** → paste it as `GOOGLE_VISION_API_KEY` in `backend/.env`
4. Create **OAuth 2.0 Credentials** → add `http://localhost:5173` to Authorized JS origins
5. Paste the **Client ID** into both `.env` files

---

## Running Tests

```bash
# Backend (from backend/ folder)
python -m pytest tests/ -v

# Frontend (from frontend/ folder)
npm test
```

---

## Docker (Optional)

```bash
# Copy and fill in root .env first
cp backend/.env.example .env

# Run everything
docker-compose up --build
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, PostgreSQL, Google OAuth, Cloud Vision |
| Frontend | React, Vite, @react-oauth/google, Axios |
| Testing | pytest, httpx, Vitest |
| OCR | Google Cloud Vision API (Bengali + English) |
