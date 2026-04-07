# SCIM Dev Server

A SCIM 2.0 development server and admin dashboard. Simulates a SCIM-compliant identity provider backend, enabling developers to test Okta (and other IdP) provisioning integrations.

## Features

- Multi-tenant SCIM 2.0 endpoints (Users, Groups, Entitlements, Roles)
- API key management with bearer-token auth
- Request logging and analytics
- HAR analyser, JWE / JWT decoder, Meeting planner
- Schema extensions — custom attributes injected into user responses at request time
- AI-assisted JSON template generator
- Per-tenant rate limiting
- **Dual database provider** — Supabase (Vercel) or native PostgreSQL (`DB_PROVIDER=postgres`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack in dev) |
| Language | TypeScript 5 — strict mode |
| Styling | Tailwind CSS v4 |
| UI | Shadcn/ui (new-york style) |
| Database | Supabase **or** native PostgreSQL |
| Auth | NextAuth 4 + Okta OAuth 2.0 |
| Container | Docker (multi-stage, standalone output) |
| Orchestration | microk8s (local k8s) |
| Tunnel | Cloudflare Tunnel (cloudflared sidecar) |
| CI/CD | GitHub Actions — self-hosted runner |

---

## Deployment options

| | Vercel + Supabase | microk8s (local) |
|---|---|---|
| Database | Supabase (managed) | PostgreSQL in-cluster |
| Hosting | Vercel edge | microk8s on your laptop |
| External access | Vercel URL | Cloudflare Tunnel |
| `DB_PROVIDER` | `supabase` (default) | `postgres` |

---

## Option A — Vercel + Supabase

### Prerequisites

- Node.js + npm
- Vercel account
- Okta OIDC application

### 1 — Create a Supabase database via Vercel

1. Vercel dashboard → **Storage** → **Create Database** → select **Supabase**
2. Follow the on-screen steps — this links Supabase to your Vercel project automatically

### 2 — Apply the database schema

In the Supabase dashboard → **SQL Editor**, run `scripts/init-postgres.sql`.
(The file works on both Supabase and plain PostgreSQL — ignore the RLS note at the top for Supabase use.)

Alternatively paste the legacy schema below if you prefer to set up RLS manually:

<details>
<summary>Legacy Supabase schema</summary>

```sql
CREATE TABLE public.scim_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resource JSONB NOT NULL,
  tenantId TEXT NOT NULL
);
CREATE TABLE public.scim_groups (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resource JSONB NOT NULL,
  tenantId TEXT NOT NULL,
  UNIQUE ("tenantId", display_name)
);
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashed_key TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  tenantId TEXT NOT NULL
);
ALTER TABLE public.scim_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scim_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON public.scim_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service role full access" ON public.scim_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service role full access" ON public.api_keys  FOR ALL USING (true) WITH CHECK (true);
```

Also run the migrations in `supabase/migrations/` in order.
</details>

### 3 — Local development

```bash
git clone https://github.com/iamarumugam-source/scim-dev-server
cd scim-dev-server
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXTAUTH_SECRET=        # openssl rand -hex 32
NEXT_PUBLIC_BASE_URL=http://localhost:3000

OKTA_CLIENT_ID=
OKTA_CLIENT_SECRET=
OKTA_ISSUER=https://your-org.okta.com/oauth2/default

LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

```bash
npm run dev   # http://localhost:3000
```

### 4 — Deploy to Vercel

1. Vercel dashboard → **Add New → Project** → import this repository
2. **Storage** tab → connect your Supabase database (adds Supabase env vars automatically)
3. **Settings → Environment Variables** — add the remaining vars from `.env.local`
4. Deploy

---

## Option B — microk8s (local, native PostgreSQL)

Runs entirely on your laptop — no Supabase account required.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  microk8s cluster (namespace: scim-dev)                 │
│                                                         │
│  ┌────────────────────────┐   ┌───────────────────┐     │
│  │  scim-dev pod          │   │  postgres-0 pod   │     │
│  │  ┌──────────────────┐  │   │  (StatefulSet)    │     │
│  │  │ app (Next.js)    │  │   │  postgres:16      │     │
│  │  │ :3000            │◄─┼───┤  :5432            │     │
│  │  ├──────────────────┤  │   └───────────────────┘     │
│  │  │ cloudflared      │  │                             │
│  │  │ (sidecar)        │  │                             │
│  │  └──────────────────┘  │                             │
│  └────────────────────────┘                             │
└─────────────────────┬───────────────────────────────────┘
                      │ Cloudflare Tunnel
                      ▼
              https://your-tunnel-hostname
```

### Prerequisites

```bash
# Enable required microk8s addons
microk8s enable dns
microk8s enable hostpath-storage

# Allow your user to run microk8s and docker without sudo
sudo usermod -aG microk8s $USER
sudo usermod -aG docker   $USER
# Log out and back in (or reboot) for the groups to apply
```

### One-time secrets setup

```bash
# Copy the template and fill in every value
cp k8s/env.template .env.k8s.local
# Edit .env.k8s.local — never commit this file

# Store it where the CI runner can find it
mkdir -p ~/.scim-dev
cp .env.k8s.local       ~/.scim-dev/.env.k8s.local
```

#### Values required in `.env.k8s.local`

| Key | How to get it |
|---|---|
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `OKTA_CLIENT_SECRET` | Okta Admin → Applications → your app |
| `POSTGRES_PASSWORD` | Any password you choose |
| `POSTGRES_URL` | `postgresql://postgres:<password>@postgres:5432/scim_dev` |
| `CF_TUNNEL_TOKEN` | Zero Trust → Networks → Tunnels → your tunnel → Configure → Token |
| `LLM_API_KEY` | Your LLM provider API key |

#### Values required in `k8s/configmap.yaml`

Fill in the `YOUR_*` placeholders then copy to `~/.scim-dev/`:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | Your Cloudflare tunnel public hostname, e.g. `https://scim-dev.example.com` |
| `NEXTAUTH_URL` | Same as above |
| `OKTA_CLIENT_ID` | Okta app client ID |
| `OKTA_ISSUER` | `https://your-org.okta.com/oauth2/default` |

```bash
cp k8s/configmap.yaml ~/.scim-dev/configmap.yaml
```

### Cloudflare tunnel dashboard (one-time)

**Zero Trust → Networks → Tunnels → your tunnel → Public Hostname → Add:**

```
Subdomain : scim-dev
Domain    : your-domain.com
Service   : HTTP
URL       : localhost:3000
```

### Okta redirect URIs (one-time)

**Okta Admin → Applications → your app → General:**

```
Sign-in redirect URI:  https://scim-dev.your-domain.com/api/auth/callback/okta
Sign-out redirect URI: https://scim-dev.your-domain.com
```

### First deploy

```bash
make image-build    # build Docker image → import into microk8s containerd
make deploy         # push secrets, apply manifests, restart pod
make db-init        # apply scripts/init-postgres.sql inside the postgres pod
```

### Makefile reference

| Target | What it does |
|---|---|
| `make image-build` | `docker build` then `microk8s ctr images import` |
| `make deploy` | Push secrets → apply manifests → rollout restart |
| `make redeploy` | `image-build` + rollout restart (for code changes) |
| `make db-init` | Run `scripts/init-postgres.sql` inside the postgres pod |
| `make db-psql` | Interactive psql session in the postgres pod |
| `make postgres-forward` | Expose postgres on `localhost:5432` for GUI tools |
| `make port-forward` | Expose app on `localhost:3000` (bypass tunnel) |
| `make logs` | Tail app + cloudflared containers |
| `make status` | Pod and service overview |
| `make secrets` | Push `.env.k8s.local` to cluster as a k8s Secret |
| `make undeploy` | Delete all cluster resources |

---

## CI/CD — GitHub Actions self-hosted runner

Every push to `feat/postgres-provider` or `master` triggers an automated build and deploy via a self-hosted runner on the same machine as microk8s.

### Register the runner (once)

1. **GitHub → repo → Settings → Actions → Runners → New self-hosted runner**
2. Follow the on-screen steps (they give you a unique registration token)
3. Install the runner into `~/actions-runner/`

### Install as a background service (Ubuntu)

A ready-made systemd unit file is included:

```bash
mkdir -p ~/.config/systemd/user
cp scripts/github-runner.service ~/.config/systemd/user/github-runner.service

# Allow the service to run at boot without an active login session
sudo loginctl enable-linger $USER

systemctl --user daemon-reload
systemctl --user enable github-runner
systemctl --user start  github-runner
```

Verify the runner is connected:

```bash
systemctl --user status github-runner
journalctl --user -u github-runner -f   # live output
```

The runner should show as **Idle** (green) in GitHub → Settings → Actions → Runners.

### Service management

```bash
systemctl --user stop    github-runner
systemctl --user start   github-runner
systemctl --user restart github-runner
```

### Stable files the runner needs

| File | Purpose |
|---|---|
| `~/.scim-dev/.env.k8s.local` | Secrets (never committed) |
| `~/.scim-dev/configmap.yaml` | Filled-in configmap (never committed) |

Both are copied into the checkout workspace at the start of every workflow run.

### Skip a deploy

```bash
git commit -m "chore: update notes [skip ci]"
```

---

## Project structure

```
src/
├── app/
│   ├── api/[userId]/scim/v2/   SCIM 2.0 REST endpoints (multi-tenant)
│   ├── api/auth/               NextAuth
│   ├── api/ai/                 AI suggestion endpoints
│   └── scim/                   Admin dashboard pages
├── components/
│   ├── ui/                     Shadcn primitives
│   ├── scim/                   Feature-specific components
│   ├── har/                    HAR analyser
│   └── jwe/                    JWE / JWT decoder
└── lib/
    └── scim/
        ├── db.ts               Supabase singleton (lazy — no-op when DB_PROVIDER=postgres)
        ├── db-postgres.ts      pg Pool singleton
        ├── services/           Provider-switching shims (13 services)
        │   ├── supabase/       Supabase implementations
        │   └── postgres/       Native pg implementations
        └── models/             SCIM TypeScript types

k8s/
├── env.template                Secret values template — copy to .env.k8s.local
├── configmap.yaml              Non-sensitive config (fill in YOUR_* values)
├── deployment.yaml             App + cloudflared sidecar
├── postgres.yaml               PostgreSQL StatefulSet + Service
├── service.yaml                ClusterIP for kubectl port-forward
├── namespace.yaml
└── kustomization.yaml

scripts/
├── init-postgres.sql           Full DB schema — works on Supabase and plain pg
└── github-runner.service       systemd unit for the CI runner

.github/workflows/
└── deploy-local.yml            CI/CD workflow (self-hosted runner)

Makefile                        All deployment commands
Dockerfile                      Multi-stage build (deps → webpack → Alpine runner)
```
