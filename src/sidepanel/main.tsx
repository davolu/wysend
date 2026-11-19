import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PRODUCT_NAME } from "../brand";
import { App } from "./App";
import "./styles.css";

document.title = PRODUCT_NAME;

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
