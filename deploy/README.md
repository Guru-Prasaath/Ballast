# Deploying Ballast

Ballast is designed to be easily deployable using **Render Blueprints**. The `render.yaml` file in the root of the repository defines all three services needed to run the monorepo:

1. **`ballast-core`**: The Node.js Nest backend API + exactly-once scheduler + integrated worker.
2. **`ballast-ai`**: The Python FastAPI advisory pipeline (optional).
3. **`ballast-web`**: The React/Vite dashboard statically deployed to Render's CDN.

## Prerequisites

1. A **Render** account.
2. A **Supabase** database (with a session pooler URL). 
   - _Note:_ Use the session pooler URL (port `5432` on `aws-X-...pooler.supabase.com`), not the direct host or transaction pooler.
3. A **Groq API Key** (optional, for the AI service to dynamically generate advisories).

## Deployment Steps

1. Push this code to a GitHub repository.
2. Log into the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** > **Blueprint**.
4. Connect the GitHub repository containing Ballast.
5. Render will detect the `render.yaml` file and prompt you to enter the required secrets:
   - `DATABASE_URL`: Your Supabase connection string.
   - `GROQ_API_KEY`: Your Groq API Key (if you are running the AI pipeline).
6. Click **Apply**.
7. Render will automatically provision the databases, run the migrations, execute the seed script (`db:seed-demo`), and start the applications.

## Post-Deployment

Once the deployment completes:
- Visit your `ballast-web` Render URL.
- Log in with the seeded demo account:
  - **Email**: `demo@ballast.dev`
  - **Password**: `ballast-demo`
- Watch the dashboard come alive as the core worker begins processing jobs asynchronously!
