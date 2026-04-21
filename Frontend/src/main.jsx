import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "react-hot-toast";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "rgba(9, 18, 28, 0.92)",
          color: "#eef7ff",
          border: "1px solid rgba(159, 216, 255, 0.16)",
          borderRadius: "16px",
          boxShadow: "0 18px 42px rgba(3, 10, 24, 0.34)",
          backdropFilter: "blur(16px)",
        },
      }}
    />
    <App />
  </React.StrictMode>
);
