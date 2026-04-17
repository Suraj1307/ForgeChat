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

## Environment Variables

Backend expects:

```bash
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=45000
OPENAI_MAX_RETRIES=1
CORS_ORIGIN=http://localhost:5173
```

## Author

Suraj Kumar  
GitHub: [https://github.com/Suraj1307](https://github.com/Suraj1307)
