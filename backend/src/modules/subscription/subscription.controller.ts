import { Request, Response } from 'express';
import { subscriptionService } from './subscription.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class SubscriptionController {
  /**
   * Get all available subscription plans
   */
  public getPlans = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const plans = await subscriptionService.getPlans();
    ApiResponse.success(res, plans, 'Subscription plans retrieved');
  });

  /**
   * Update plan configuration (Super Admin)
   */
  public updatePlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const planKey = String(Array.isArray(req.params.planKey) ? req.params.planKey[0] : req.params.planKey);
    const updated = await subscriptionService.updatePlanConfig(planKey, req.body);
    ApiResponse.success(res, updated, `Plan ${planKey} updated successfully`);
  });

  /**
   * Get current tenant's active subscription status & usage
   */
  public getMyStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const status = await subscriptionService.getTenantSubscription(tenantId);
    ApiResponse.success(res, status, 'Tenant subscription status retrieved');
  });

  /**
   * Initiate subscription checkout (bKash / Nagad / SSLCommerz)
   */
  public initiateCheckout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { planKey, billingCycle = 'MONTHLY', provider = 'BKASH', idempotencyKey } = req.body;

    if (!planKey) {
      throw new BadRequestError('planKey is required');
    }

    const result = await subscriptionService.initiatePayment(tenantId, {
      planKey,
      billingCycle,
      provider,
      idempotencyKey,
    });

    ApiResponse.created(res, result, 'Payment checkout session initiated');
  });

  /**
   * Verify and execute payment (Backend Validation Gateway)
   * CRITICAL: Plan is never activated without server-side verification!
   */
  public verifyPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { transactionCode, providerTransactionId, signature, status = 'SUCCESS' } = req.body;

    if (!transactionCode) {
      throw new BadRequestError('transactionCode is required');
    }

    const result = await subscriptionService.verifyAndExecutePayment({
      transactionCode,
      providerTransactionId,
      signature,
      status,
    });

    ApiResponse.success(res, result, 'Payment verified and subscription activated successfully');
  });

  /**
   * Get tenant billing and transaction history
   */
  public getBillingHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const history = await subscriptionService.getBillingHistory(tenantId);
    ApiResponse.success(res, history, 'Billing history retrieved');
  });

  /**
   * Download official vector PDF tax invoice
   */
  public downloadInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const invoiceNumber = String(
      Array.isArray(req.params.invoiceNumber) ? req.params.invoiceNumber[0] : req.params.invoiceNumber
    );

    const pdfBuffer = await subscriptionService.generateInvoicePdf(invoiceNumber, tenantId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  });

  /**
   * Get proration quote for upgrade/downgrade
   */
  public getProrationQuote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { targetPlanKey, targetBillingCycle = 'MONTHLY' } = req.body;

    if (!targetPlanKey) {
      throw new BadRequestError('targetPlanKey is required');
    }

    const quote = await subscriptionService.calculateProrationQuote(
      tenantId,
      targetPlanKey,
      targetBillingCycle
    );
    ApiResponse.success(res, quote, 'Proration quote calculated');
  });

  /**
   * Check downgrade eligibility
   */
  public checkDowngradeEligibility = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { targetPlanKey } = req.body;

    if (!targetPlanKey) {
      throw new BadRequestError('targetPlanKey is required');
    }

    const result = await subscriptionService.validateDowngradeEligibility(tenantId, targetPlanKey);
    ApiResponse.success(res, result, 'Downgrade eligibility checked');
  });

  /**
   * Granular usage metering against quotas
   */
  public getUsageMetering = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const metering = await subscriptionService.getUsageMetering(tenantId);
    ApiResponse.success(res, metering, 'Usage metering retrieved');
  });

  /**
   * Retry payment transaction
   */
  public retryPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.tenant!._id.toString();
    const { transactionCode } = req.body;

    if (!transactionCode) {
      throw new BadRequestError('transactionCode is required');
    }

    const result = await subscriptionService.retryPayment(transactionCode, tenantId);
    ApiResponse.success(res, result, 'Payment retry initiated');
  });

  // ===================== Super Admin Operations =====================

  /**
   * Super Admin: View all tenant subscriptions
   */
  public adminGetSubscriptions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, plan, search, page = '1', limit = '20' } = req.query;
    const result = await subscriptionService.getAllSubscriptions({
      status: status as string,
      plan: plan as string,
      search: search as string,
      page: parseInt(String(page)),
      limit: parseInt(String(limit)),
    });
    ApiResponse.success(res, result, 'All subscriptions retrieved for Super Admin');
  });

  /**
   * Super Admin: View all payment transactions
   */
  public adminGetTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, provider, search, page = '1', limit = '20' } = req.query;
    const result = await subscriptionService.getAllTransactions({
      status: status as string,
      provider: provider as string,
      search: search as string,
      page: parseInt(String(page)),
      limit: parseInt(String(limit)),
    });
    ApiResponse.success(res, result, 'All transactions retrieved for Super Admin');
  });

  /**
   * Super Admin: Transition tenant subscription status (e.g. suspend/reactivate)
   */
  public adminTransitionSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenantId = String(Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId);
    const { status, reason } = req.body;
    const adminUserId = req.user?._id?.toString();

    if (!status) {
      throw new BadRequestError('New status is required');
    }

    const updated = await subscriptionService.transitionTenantSubscription(
      tenantId,
      status,
      reason,
      adminUserId
    );
    ApiResponse.success(res, updated, `Tenant subscription transitioned to ${status}`);
  });

  /**
   * Super Admin: Process refund for a transaction
   */
  public adminRefundTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const transactionCode = String(
      Array.isArray(req.params.transactionCode) ? req.params.transactionCode[0] : req.params.transactionCode
    );
    const { reason = 'Refund requested by Super Admin' } = req.body;
    const adminUserId = req.user?._id?.toString();

    const result = await subscriptionService.refundTransaction(transactionCode, reason, adminUserId);
    ApiResponse.success(res, result, `Transaction ${transactionCode} refunded successfully`);
  });
}

export const subscriptionController = new SubscriptionController();

