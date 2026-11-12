import { useActionState } from 'react'
import { Link } from 'react-router'
import { fieldErrorsFrom422 } from '../api/client'
import { useLogin } from '../api/generated'
import type { LoginCredentials } from '../api/generated/model'
import { saveSession } from '../auth/session'
import { PasswordField } from '../components/PasswordField'
import { SubmitButton } from '../components/SubmitButton'
import { TextField } from '../components/TextField'
import styles from './auth.module.css'

type Field = keyof LoginCredentials
type FieldErrors = Partial<Record<Field, string>>

type State = { status: 'idle' | 'error'; values: LoginCredentials; fieldErrors: FieldErrors; formError?: string }

const EMPTY: LoginCredentials = { email: '', password: '' }

function validate({ email, password }: LoginCredentials): FieldErrors {
  const errors: FieldErrors = {}
  if (!email) errors.email = 'Enter your email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
  // No length rule here: login only checks the password, it doesn't set one.
  if (!password) errors.password = 'Enter your password.'
  return errors
}

function readValues(formData: FormData): LoginCredentials {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  }
}

export function LoginPage() {
  const { mutateAsync: login } = useLogin()

  const [state, formAction] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const values = readValues(formData)
      const fieldErrors = validate(values)
      if (Object.keys(fieldErrors).length) return { status: 'error', values, fieldErrors }

      try {
        // The generated fetch client resolves (doesn't throw) on non-2xx, so branch on status.
        const res = await login({ data: values })
        if (res.status === 200) {
          // Storing the session is the whole success path: RedirectIfAuthed sees it and moves into the app.
          saveSession(res.data)
          return { status: 'idle', values: EMPTY, fieldErrors: {} }
        }
        // 401 isn't declared in the OpenAPI spec, so it's outside the generated status union.
        // Same message for unknown email and wrong password, so the form doesn't reveal which accounts exist.
        if ((res.status as number) === 401)
          return { status: 'error', values, fieldErrors: {}, formError: 'Incorrect email or password.' }
        if (res.status === 422) return { status: 'error', values, fieldErrors: fieldErrorsFrom422(res.data) }
      } catch (err) {
        if (err instanceof TypeError)
          return { status: 'error', values, fieldErrors: {}, formError: "Couldn't reach the server. Check your connection and try again." }
      }
      return { status: 'error', values, fieldErrors: {}, formError: 'Something went wrong. Please try again.' }
    },
    { status: 'idle', values: EMPTY, fieldErrors: {} },
  )

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand} aria-hidden="true">
          <span className={styles.mark} />
          rag-bot
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>Log in</h1>
          <p className={styles.subtitle}>Welcome back. Pick up where you left off.</p>
        </header>

        {state.formError && (
          <div className={styles.alert} role="alert">
            {state.formError}
          </div>
        )}

        <form action={formAction} className={styles.form} noValidate>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            defaultValue={state.values.email}
            error={state.fieldErrors.email}
            required
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            defaultValue={state.values.password}
            error={state.fieldErrors.password}
            required
          />
          <SubmitButton className={styles.submit}>Log in</SubmitButton>
        </form>

        <p className={styles.footer}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </main>
  )
}
