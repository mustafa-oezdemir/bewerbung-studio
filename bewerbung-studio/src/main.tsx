import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RendererErrorBoundary } from "./components/RendererErrorBoundary";
import "./app.css";

const root = document.getElementById("app");

if (!root) throw new Error("App-Container wurde nicht gefunden.");

createRoot(root).render(
  <StrictMode>
    <RendererErrorBoundary><App /></RendererErrorBoundary>
  </StrictMode>,
);
