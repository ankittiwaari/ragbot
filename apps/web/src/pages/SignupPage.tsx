import { useActionState } from 'react'
import { Link } from 'react-router'
import { fieldErrorsFrom422 } from '../api/client'
import { useSignup } from '../api/generated'
import type { CreateUserRequest } from '../api/generated/model'
import { PasswordField } from '../components/PasswordField'
import { SubmitButton } from '../components/SubmitButton'
import { TextField } from '../components/TextField'
import styles from './auth.module.css'

type Field = keyof CreateUserRequest
type FieldErrors = Partial<Record<Field, string>>

type State =
  | { status: 'idle' | 'error'; values: CreateUserRequest; fieldErrors: FieldErrors; formError?: string }
  | { status: 'success'; email: string }

const EMPTY: CreateUserRequest = { first_name: '', last_name: '', email: '', password: '' }
const MIN_PASSWORD = 8

function validate({ first_name, last_name, email, password }: CreateUserRequest): FieldErrors {
  const errors: FieldErrors = {}
  if (!first_name) errors.first_name = 'Enter your first name.'
  if (!last_name) errors.last_name = 'Enter your last name.'
  if (!email) errors.email = 'Enter your email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
  if (password.length < MIN_PASSWORD) errors.password = `Use at least ${MIN_PASSWORD} characters.`
  return errors
}

function readValues(formData: FormData): CreateUserRequest {
  return {
    first_name: String(formData.get('first_name') ?? '').trim(),
    last_name: String(formData.get('last_name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  }
}

export function SignupPage() {
  const { mutateAsync: signup } = useSignup()

  const [state, formAction] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const values = readValues(formData)
      const fieldErrors = validate(values)
      if (Object.keys(fieldErrors).length) return { status: 'error', values, fieldErrors }

      try {
        // The generated fetch client resolves (doesn't throw) on non-2xx, so branch on status.
        const res = await signup({ data: values })
        // 409 isn't declared in the OpenAPI spec, so it's outside the generated status union.
        if ((res.status as number) === 409)
          return { status: 'error', values, fieldErrors: { email: 'An account with this email already exists.' } }
        if (res.status === 201) return { status: 'success', email: res.data.email }
        if (res.status === 422) return { status: 'error', values, fieldErrors: fieldErrorsFrom422(res.data) }
      } catch (err) {
        // fetch rejects with a TypeError when the server is unreachable
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

        {state.status === 'success' ? (
          <div className={styles.success} role="status">
            <h1 className={styles.title}>You're all set</h1>
            <p className={styles.subtitle}>
              Your account for <strong>{state.email}</strong> has been created.
            </p>
            <Link to="/login">Continue to log in</Link>
          </div>
        ) : (
          <>
            <header className={styles.header}>
              <h1 className={styles.title}>Create your account</h1>
              <p className={styles.subtitle}>Start chatting with your documents.</p>
            </header>

            {state.formError && (
              <div className={styles.alert} role="alert">
                {state.formError}
              </div>
            )}

            <form action={formAction} className={styles.form} noValidate>
              <div className={styles.row}>
                <TextField
                  label="First name"
                  name="first_name"
                  autoComplete="given-name"
                  placeholder="Ada"
                  defaultValue={state.values.first_name}
                  error={state.fieldErrors.first_name}
                  required
                />
                <TextField
                  label="Last name"
                  name="last_name"
                  autoComplete="family-name"
                  placeholder="Lovelace"
                  defaultValue={state.values.last_name}
                  error={state.fieldErrors.last_name}
                  required
                />
              </div>
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
                autoComplete="new-password"
                defaultValue={state.values.password}
                hint={`At least ${MIN_PASSWORD} characters.`}
                error={state.fieldErrors.password}
                minLength={MIN_PASSWORD}
                required
              />
              <SubmitButton className={styles.submit}>Create account</SubmitButton>
            </form>

            <p className={styles.footer}>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
