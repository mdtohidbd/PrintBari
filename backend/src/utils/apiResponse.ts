import { Response } from 'express';

export interface ApiResponseOptions<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  meta?: Record<string, any>;
}

export class ApiResponse {
  public static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200,
    meta?: Record<string, any>
  ): Response {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
    });
  }

  public static created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully',
    meta?: Record<string, any>
  ): Response {
    return this.success(res, data, message, 201, meta);
  }
}

