import { apiPost } from './client'

// snake_case to match the FastAPI schema, so 422 `loc` entries map straight to form fields
export type SignupRequest = {
  first_name: string
  last_name: string
  email: string
  password: string
}

export type SignupResponse = {
  id: string
  email: string
  first_name: string
  last_name: string
}

/** POST /api/auth/signup — not yet implemented in apps/api. */
export function signup(data: SignupRequest) {
  return apiPost<SignupResponse>('/auth/signup', data)
}
