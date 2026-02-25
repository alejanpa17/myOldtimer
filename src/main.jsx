import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

registerSW({ immediate: true });

const isSubpathDeploy = import.meta.env.BASE_URL !== "/";
const Router = isSubpathDeploy ? HashRouter : BrowserRouter;
const routerProps = isSubpathDeploy
  ? { basename: import.meta.env.BASE_URL }
  : {};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router {...routerProps}>
      <App />
    </Router>
  </React.StrictMode>
);
