import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import { SignupPage } from './pages/SignupPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SignupPage />
  </StrictMode>,
)
