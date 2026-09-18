import { AppError } from "../utils/appError.js";

const errorHandler = (error, req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR";
  const message = error instanceof AppError ? error.message : "Internal server error.";

  if (statusCode >= 500) {
    console.error(`[${req.method}] ${req.originalUrl}`, error);
  }

  res.status(statusCode).json({
    error: message,
    code,
  });
};

export default errorHandler;
