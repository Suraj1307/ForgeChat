# ForgeChat

ForgeChat is a full-stack AI chat application built with React, Express, and MongoDB. It supports authentication, persistent threads, streaming responses, and lightweight file attachments in a single deployable service.

Live demo: [https://forgechat.onrender.com](https://forgechat.onrender.com)

## Features

- JWT-based authentication
- Streaming AI chat responses
- Persistent thread history
- Chat thread deletion
- Text, code, PDF, DOCX, and image attachments
- Responsive single-service deployment

## Tech Stack

Frontend
- React
- Vite
- Context API

Backend
- Node.js
- Express
- MongoDB with Mongoose
- JWT authentication

## Project Structure

```text
ForgeChat/
|-- Backend/
|-- Frontend/
`-- package.json
```

## Run Locally

```bash
git clone https://github.com/Suraj1307/ForgeChat.git
cd ForgeChat
npm run install:all
npm run build
npm run start
```

The app runs at `http://localhost:5000`.

For Render, use the repository root as the service root, configure the build command as
`npm run install:all && npm run build`, and configure the start command as `npm run start`.
The build must complete before the Node service starts so the generated Vite asset hashes
match the deployed `index.html`.

## Environment Variables

Backend expects:

```bash
MONGODB_URI=your_mongodb_connection_string
MONGODB_URI_FALLBACK=optional_non_srv_connection_string
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_MS=45000
GEMINI_MAX_RETRIES=1
CORS_ORIGIN=http://localhost:5173
PORT=5000
NODE_ENV=production
```

Frontend supports:

```bash
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_API_PROXY_TARGET=http://127.0.0.1:5000
```

## Author

Suraj Kumar  
GitHub: [https://github.com/Suraj1307](https://github.com/Suraj1307)
