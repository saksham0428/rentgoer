import { Request, Response, NextFunction } from 'express';

// Express requires exactly 4 arguments to recognize an error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error(`[ERROR] ${req.method} ${req.url}`);
  // Log the detailed error on the server side only
  console.error(err);

  // If headers are already sent, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle generic 500 error gracefully without leaking stack traces or internals
  res.status(err.status || 500).json({
    success: false,
    message: err.message && err.status && err.status < 500 ? err.message : 'Internal server error',
  });
};
