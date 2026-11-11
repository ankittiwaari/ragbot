# web

React 19 + Vite + TypeScript frontend for rag-bot.

```bash
npm install
npm run dev     # http://localhost:5173, proxies /api -> http://localhost:8000
npm run build
npm run lint
```

## Layout

- `src/styles/tokens.css` — design tokens (color, type, spacing, radius, motion). Light + dark via `prefers-color-scheme`. Components use tokens only.
- `src/styles/base.css` — reset and global defaults.
- `src/components/` — `Button`, `SubmitButton`, `TextField`, `PasswordField` (CSS Modules).
- `src/pages/` — `SignupPage` (React 19 `useActionState` form action).
- `src/api/` — fetch wrapper + `signup()`; swap for an OpenAPI-generated client later.

The signup form posts to `POST /api/auth/signup` with `{ first_name, last_name, email, password }`.
It maps `409` to an email error and FastAPI `422` validation details to field errors.
