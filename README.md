🚀 ForgeChat

ForgeChat is a full-stack ChatGPT-like web application built with the MERN stack.
It supports user authentication, persistent chat threads, and AI-powered conversations, deployed as a single production service.

🌐 Live Demo: https://forgechat.onrender.com

✨ Key Features

🔐 JWT-based Authentication (Signup / Login)

💬 ChatGPT-style AI chat interface

🧵 Persistent chat history (MongoDB)

🗑️ Delete chat threads

⚡ Single-service deployment (no CORS issues)

📱 Responsive UI

🛠 Tech Stack

Frontend

React (Vite)

Context API

CSS

Backend

Node.js

Express (ES Modules)

MongoDB (Mongoose)

JWT Authentication

Deployment

Render (Monorepo, single service)

📁 Project Structure
ForgeChat/
├── Backend/   → Express API + MongoDB
├── Frontend/  → React (Vite)
└── package.json (root scripts)

🚀 Deployment Highlights

Frontend build served directly by Express

Monorepo setup with a single Render service

Production-safe asset handling

Express 5 compatible SPA routing

Linux-safe case-sensitive paths

▶️ Run Locally
git clone https://github.com/Suraj1307/ForgeChat.git
cd ForgeChat
npm run install:all
npm run build
npm run start


App runs at:

http://localhost:5000

👨‍💻 Author

Suraj Kumar
CSE Undergraduate, KIIT University
GitHub: https://github.com/Suraj1307
