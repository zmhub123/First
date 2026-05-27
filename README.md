# React + FastAPI Fullstack Skeleton

This folder contains a minimal fullstack project scaffold:

- `frontend/`: React app built with Vite (Mario prototype game)
- `backend/`: FastAPI service (SQLite save/continue API)

## Prerequisites

- Node.js 18+
- Python 3.10+

## 1) Run backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`.

## 2) Run frontend (React)

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API Notes

- Health check: `GET /api/health`
- Demo message: `GET /api/message`
- Load saved game: `GET /api/game/save`
- Save game: `POST /api/game/save` with JSON:
  - `level` (int)
  - `lives` (int)
  - `coins` (int)

Frontend reads backend URL from `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).

## GitHub Pages（`docs/` 目录）

本仓库通过 `docs/` 发布静态前端，访问地址：

`https://zmhub123.github.io/First/`

### 构建并更新 `docs/`

```bash
cd frontend
npm install
npm run build:pages
```

然后在 GitHub 仓库 **Settings → Pages** 中：

- **Source**: Deploy from a branch
- **Branch**: `main`
- **Folder**: `/docs`

> 说明：GitHub Pages 仅托管前端静态资源；存档/读档 API 需单独部署 FastAPI 后端，并在构建时设置 `VITE_API_BASE_URL` 指向该后端地址。

## Game Notes

- Click **开始游戏** to start instantly.
- Click **继续游戏** to load save from SQLite.
- Click **保存进度** to store current `level/lives/coins`.
