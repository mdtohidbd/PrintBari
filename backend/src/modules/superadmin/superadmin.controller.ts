import { Request, Response } from 'express';
import { superAdminService } from './superadmin.service';
import { revenueIntelligenceService } from './revenueIntelligence.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class SuperAdminController {
  // ─── Dashboard ───
  public getDashboard = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await superAdminService.getDashboardStats();
    ApiResponse.success(res, stats, 'Super Admin dashboard data retrieved');
  });

  // ─── Shop Management ───
  public getShops = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, status, plan, search, sortBy, sortOrder } = req.query as Record<string, string>;
    const result = await superAdminService.getShops({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      plan,
      search,
      sortBy,
      sortOrder,
    });
    ApiResponse.success(res, result, 'Shops retrieved');
  });

  public getShopDetails = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const shopId = String(Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId);
    const result = await superAdminService.getShopDetails(shopId);
    ApiResponse.success(res, result, 'Shop details retrieved');
  });

  public suspendShop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const shopId = String(Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId);
    const { reason } = req.body;
    if (!reason) throw new BadRequestError('Suspension reason is required');
    const shop = await superAdminService.suspendShop(shopId, req.user!._id.toString(), reason);
    ApiResponse.success(res, shop, 'Shop suspended successfully');
  });

  public activateShop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const shopId = String(Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId);
    const shop = await superAdminService.activateShop(shopId, req.user!._id.toString());
    ApiResponse.success(res, shop, 'Shop activated successfully');
  });

  public updateShopSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const shopId = String(Array.isArray(req.params.shopId) ? req.params.shopId[0] : req.params.shopId);
    const shop = await superAdminService.updateShopSubscription(shopId, req.user!._id.toString(), req.body);
    ApiResponse.success(res, shop, 'Shop subscription updated');
  });

  // ─── Plan Management ───
  public getPlans = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const plans = await superAdminService.getPlans();
    ApiResponse.success(res, plans, 'Plans retrieved');
  });

  public createPlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const plan = await superAdminService.createPlan(req.body, req.user!._id.toString());
    ApiResponse.created(res, plan, 'Plan created successfully');
  });

  public updatePlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const planKey = String(Array.isArray(req.params.planKey) ? req.params.planKey[0] : req.params.planKey);
    const plan = await superAdminService.updatePlan(planKey, req.body, req.user!._id.toString());
    ApiResponse.success(res, plan, 'Plan updated successfully');
  });

  public archivePlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const planKey = String(Array.isArray(req.params.planKey) ? req.params.planKey[0] : req.params.planKey);
    const plan = await superAdminService.archivePlan(planKey, req.user!._id.toString());
    ApiResponse.success(res, plan, 'Plan archived successfully');
  });

  // ─── Payment Management ───
  public getTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, status, provider, search } = req.query as Record<string, string>;
    const result = await superAdminService.getTransactions({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      provider,
      search,
    });
    ApiResponse.success(res, result, 'Transactions retrieved');
  });

  public getInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, status } = req.query as Record<string, string>;
    const result = await superAdminService.getInvoices({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
    });
    ApiResponse.success(res, result, 'Invoices retrieved');
  });

  public getPaymentStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await superAdminService.getPaymentStats();
    ApiResponse.success(res, stats, 'Payment statistics retrieved');
  });

  // ─── Platform Settings ───
  public getSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const category = req.query.category as string | undefined;
    const settings = await superAdminService.getSettings(category);
    ApiResponse.success(res, settings, 'Platform settings retrieved');
  });

  public updateSetting = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const key = String(Array.isArray(req.params.key) ? req.params.key[0] : req.params.key);
    const { value } = req.body;
    if (value === undefined) throw new BadRequestError('Setting value is required');
    const setting = await superAdminService.updateSetting(key, value, req.user!._id.toString());
    ApiResponse.success(res, setting, 'Setting updated successfully');
  });

  public bulkUpdateSettings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestError('updates array is required');
    }
    const results = await superAdminService.bulkUpdateSettings(updates, req.user!._id.toString());
    ApiResponse.success(res, results, 'Settings updated in bulk');
  });

  // ─── Audit Logs ───
  public getAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, action, tenantId, status } = req.query as Record<string, string>;
    const result = await superAdminService.getAuditLogs({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      action,
      tenantId,
      status,
    });
    ApiResponse.success(res, result, 'Audit logs retrieved');
  });

  // ─── Dynamic Role Permissions ───
  public getRolePermissions = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await superAdminService.getRolePermissions();
    ApiResponse.success(res, list, 'Role permissions retrieved');
  });

  public updateRolePermissions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const role = String(Array.isArray(req.params.role) ? req.params.role[0] : req.params.role);
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) throw new BadRequestError('permissions array is required');
    const updated = await superAdminService.updateRolePermissions(role, permissions, req.user!._id.toString());
    ApiResponse.success(res, updated, 'Role permissions updated successfully');
  });

  // ─── Dynamic Global Passport Presets ───
  public getGlobalPresets = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await superAdminService.getGlobalPresets();
    ApiResponse.success(res, list, 'Global passport presets retrieved');
  });

  public upsertGlobalPreset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const preset = await superAdminService.upsertGlobalPreset(req.body, req.user!._id.toString());
    ApiResponse.success(res, preset, 'Global passport preset saved');
  });

  public deleteGlobalPreset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const presetKey = String(Array.isArray(req.params.presetKey) ? req.params.presetKey[0] : req.params.presetKey);
    await superAdminService.deleteGlobalPreset(presetKey, req.user!._id.toString());
    ApiResponse.success(res, null, 'Global passport preset deleted');
  });

  // ─── Dynamic Global CV Templates ───
  public getGlobalCvTemplates = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await superAdminService.getGlobalCvTemplates();
    ApiResponse.success(res, list, 'Global CV templates retrieved');
  });

  public upsertGlobalCvTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const template = await superAdminService.upsertGlobalCvTemplate(req.body, req.user!._id.toString());
    ApiResponse.success(res, template, 'Global CV template saved');
  });

  public deleteGlobalCvTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const templateKey = String(Array.isArray(req.params.templateKey) ? req.params.templateKey[0] : req.params.templateKey);
    await superAdminService.deleteGlobalCvTemplate(templateKey, req.user!._id.toString());
    ApiResponse.success(res, null, 'Global CV template deleted');
  });

  // ─── Dynamic Global Service Catalog ───
  public getGlobalServices = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const list = await superAdminService.getGlobalServices();
    ApiResponse.success(res, list, 'Global services retrieved');
  });

  public upsertGlobalService = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const service = await superAdminService.upsertGlobalService(req.body, req.user!._id.toString());
    ApiResponse.success(res, service, 'Global service saved');
  });

  // ─── Financial Intelligence & Revenue Operations ───
  public getRevenueMetrics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period } = req.query as { period?: string };
    const result = await revenueIntelligenceService.calculateMRRAndMetrics(period);
    ApiResponse.success(res, result, 'SaaS revenue metrics calculated successfully');
  });

  public getUnitEconomics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { tenantId, period } = req.query as { tenantId?: string; period?: string };
    const result = await revenueIntelligenceService.calculateTenantUnitEconomics(tenantId, period);
    ApiResponse.success(res, result, 'Tenant unit economics and COGS retrieved');
  });

  public getCohortAnalysis = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { months } = req.query as { months?: string };
    const monthsBack = months ? parseInt(months, 10) : 6;
    const result = await revenueIntelligenceService.getCustomerCohortAnalysis(monthsBack);
    ApiResponse.success(res, result, 'Customer cohort analysis retrieved');
  });

  public getSubscriptionRenewals = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { days } = req.query as { days?: string };
    const daysAhead = days ? parseInt(days, 10) : 30;
    const result = await revenueIntelligenceService.getSubscriptionRenewalReport(daysAhead);
    ApiResponse.success(res, result, 'Subscription renewal pipeline retrieved');
  });

  public getPlanDistribution = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const result = await revenueIntelligenceService.getPlanWiseRevenue();
    ApiResponse.success(res, result, 'Plan-wise revenue distribution retrieved');
  });

  public getMonthlyFinancialReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period } = req.query as { period?: string };
    const result = await revenueIntelligenceService.getMonthlyRevenueReport(period);
    ApiResponse.success(res, result, 'Executive monthly financial report retrieved');
  });

  public getCostConfig = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const config = await revenueIntelligenceService.ensureCostConfig();
    ApiResponse.success(res, config, 'Cost structure configuration retrieved');
  });

  public updateCostConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const config = await revenueIntelligenceService.updateCostConfig(req.body);
    ApiResponse.success(res, config, 'Cost structure configuration updated');
  });

  public recordMarketingSpend = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period, adSpend, salesCommissions, marketingPersonnel, toolsAndSoftware, newPayingCustomersAcquired, notes } = req.body;
    if (!period) throw new BadRequestError('Period (YYYY-MM) is required');
    const result = await revenueIntelligenceService.recordMarketingSpend({
      period,
      adSpend,
      salesCommissions,
      marketingPersonnel,
      toolsAndSoftware,
      newPayingCustomersAcquired,
      notes,
    });
    ApiResponse.success(res, result, 'Marketing & sales spend recorded');
  });
}

export const superAdminController = new SuperAdminController();

