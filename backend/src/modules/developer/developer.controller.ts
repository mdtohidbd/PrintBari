import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { DeveloperService } from './developer.service';
import { ApiResponse } from '../../utils/apiResponse';
import { BadRequestError } from '../../errors';

export class DeveloperController {
  // API Keys
  static createApiKey = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;
    const result = await DeveloperService.createApiKey(tenantId, userId, req.body);
    ApiResponse.created(res, result, 'API key created successfully');
  });

  static listApiKeys = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const keys = await DeveloperService.listApiKeys(tenantId);
    ApiResponse.success(res, { keys }, 'API keys retrieved successfully');
  });

  static rotateApiKey = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const userId = req.user!._id;
    const keyId = req.params.keyId as string;
    const result = await DeveloperService.rotateApiKey(tenantId, keyId, userId);
    ApiResponse.success(res, result, 'API key rotated successfully');
  });

  static revokeApiKey = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const keyId = req.params.keyId as string;
    const { reason } = req.body;
    const result = await DeveloperService.revokeApiKey(tenantId, keyId, reason);
    ApiResponse.success(res, result, 'API key revoked');
  });

  // Webhook Subscriptions
  static createWebhook = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const result = await DeveloperService.createWebhookSubscription(tenantId, req.body);
    ApiResponse.created(res, result, 'Webhook subscription created successfully');
  });

  static listWebhooks = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const subscriptions = await DeveloperService.listWebhookSubscriptions(tenantId);
    ApiResponse.success(res, { subscriptions }, 'Webhook subscriptions retrieved');
  });

  static updateWebhook = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const subId = req.params.subId as string;
    const result = await DeveloperService.updateWebhookSubscription(tenantId, subId, req.body);
    ApiResponse.success(res, result, 'Webhook subscription updated');
  });

  static deleteWebhook = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const subId = req.params.subId as string;
    await DeveloperService.deleteWebhookSubscription(tenantId, subId);
    ApiResponse.success(res, { deleted: true }, 'Webhook subscription deleted');
  });

  static rotateWebhookSecret = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const subId = req.params.subId as string;
    const result = await DeveloperService.rotateWebhookSecret(tenantId, subId);
    ApiResponse.success(res, result, 'Webhook secret rotated successfully');
  });

  static listDeliveryLogs = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const { subscriptionId, deliveryStatus, limit } = req.query;
    const logs = await DeveloperService.listDeliveryLogs(tenantId, {
      subscriptionId: subscriptionId as string,
      deliveryStatus: deliveryStatus as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });
    ApiResponse.success(res, { logs }, 'Webhook delivery logs retrieved');
  });

  static testPingWebhook = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const subId = req.params.subId as string;
    const result = await DeveloperService.testPingWebhook(tenantId, subId);
    ApiResponse.success(res, result, 'Webhook ping test initiated');
  });

  // Third-Party Integrations
  static listIntegrations = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const integrations = await DeveloperService.listTenantIntegrations(tenantId);
    ApiResponse.success(res, { integrations }, 'Integrations retrieved successfully');
  });

  static configureIntegration = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const result = await DeveloperService.configureIntegration(tenantId, req.body);
    ApiResponse.success(res, result, 'Integration configuration saved');
  });

  // Accounting Export
  static exportAccounting = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenant!._id;
    const format = (req.query.format as string) === 'CSV' ? 'CSV' : 'TALLY_XML';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const file = await DeveloperService.exportAccounting(tenantId, format, startDate, endDate);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.status(200).send(file.content);
  });
}
