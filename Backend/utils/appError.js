class AppError extends Error {
  constructor(statusCode, message, code = "APP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const createAppError = (statusCode, message, code) => new AppError(statusCode, message, code);

export { AppError, createAppError };
