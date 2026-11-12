import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/base.css";
import { RedirectIfAuthed, RequireAuth } from "./auth/RequireAuth";
import { DocumentsPage } from "./pages/DocumentsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SignupPage } from "./pages/SignupPage";
import { AppShell } from "./shell/AppShell";

const queryClient = new QueryClient();

// Pages set their own <title>; React 19 hoists it into <head>.
const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <RedirectIfAuthed>
        <title>Log in · rag-bot</title>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: "/signup",
    element: (
      <RedirectIfAuthed>
        <title>Sign up · rag-bot</title>
        <SignupPage />
      </RedirectIfAuthed>
    ),
  },
  {
    // Everything else needs a session and renders inside the shell.
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <>
            <title>Home · rag-bot</title>
            <HomePage />
          </>
        ),
      },
      {
        path: "chat",
        element: (
          <>
            <title>Chat · rag-bot</title>
            <PlaceholderPage
              title="Chat"
              subtitle="Ask questions and get answers grounded in your documents."
              icon="chat"
              emptyTitle="No conversations yet"
            >
              Chat isn’t available yet. Once it is, your conversations will show up here.
            </PlaceholderPage>
          </>
        ),
      },
      {
        path: "documents",
        element: (
          <>
            <title>Documents · rag-bot</title>
            <DocumentsPage />
          </>
        ),
      },
      {
        path: "*",
        element: (
          <>
            <title>Not found · rag-bot</title>
            <PlaceholderPage
              title="Page not found"
              subtitle="This address doesn’t match any page."
              icon="file"
              emptyTitle="Nothing here"
            >
              Check the address, or go back <Link to="/">home</Link>.
            </PlaceholderPage>
          </>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
