import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { LocalHostProvider } from "./AuthGate.jsx";
import "./styles.css";
import "./shell-polish.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LocalHostProvider><App /></LocalHostProvider>
  </React.StrictMode>,
);
