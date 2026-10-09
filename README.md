# RentGoer

RentGoer is a direct rental marketplace designed to connect property owners and tenants without traditional brokers or middlemen.

## Project Structure

This project follows a clear separation of concerns between the frontend and backend:

- `frontend/`: Next.js application (React, TypeScript, Tailwind CSS)
- `backend/`: Express.js application (Node.js, TypeScript, REST API)

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Environment Setup

1. Copy `.env.example` to `.env` in the `backend/` directory and update the variables.
2. Copy `.env.example` to `.env` (or `.env.local`) in the `frontend/` directory and update the variables.

### Running the Backend

```bash
cd backend
npm install
npm run dev
```

The backend server will run on `http://localhost:5000`.

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend application will run on `http://localhost:3000`.

## Architecture & Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide React
- **Backend:** Node.js, Express.js, TypeScript, REST API
- **Database:** PostgreSQL (Prisma ORM) - *Coming soon*
- **Authentication:** HTTP-only cookies/tokens - *Coming soon*
- **Storage:** Cloudinary - *Coming soon*
- **Maps:** Mapbox - *Coming soon*
