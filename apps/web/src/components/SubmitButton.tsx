import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from './Button'

/** A submit button that shows a spinner while its parent <form action> is pending. */
export function SubmitButton(props: Omit<ComponentProps<typeof Button>, 'type' | 'loading'>) {
  const { pending } = useFormStatus()
  return <Button {...props} type="submit" loading={pending} />
}
