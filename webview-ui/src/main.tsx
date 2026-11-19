import "./fonts.ts";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const container =
  document.getElementById("root") ?? Object.assign(document.body.appendChild(document.createElement("div")), { id: "root" });

createRoot(container).render(<App />);
