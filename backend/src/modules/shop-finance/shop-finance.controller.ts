import { Request, Response } from 'express';
import { shopFinanceService } from './shop-finance.service';
import { ApiResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError } from '../../errors';

export class ShopFinanceController {
  public recordPOSSale = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Cashier',
    };

    const data = await shopFinanceService.recordPOSSale(tenantId, user, req.body);
    ApiResponse.success(res, data, 'POS sale transaction recorded successfully', 201);
  });

  public collectCustomerDue = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Cashier',
    };

    const { customerId, amount, paymentMethod, referenceNote, idempotencyKey } = req.body;
    if (!customerId || !amount) {
      throw new BadRequestError('Customer ID and payment amount are required.');
    }

    const data = await shopFinanceService.collectCustomerDue(tenantId, user, {
      customerId,
      amount,
      paymentMethod,
      referenceNote,
      idempotencyKey,
    });
    ApiResponse.success(res, data, 'Customer due payment collected successfully');
  });

  public recordExpense = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Manager',
    };

    const { amount, category, paymentMethod, referenceNote, idempotencyKey } = req.body;
    const data = await shopFinanceService.recordExpense(tenantId, user, {
      amount,
      category,
      paymentMethod,
      referenceNote,
      idempotencyKey,
    });
    ApiResponse.success(res, data, 'Shop expense recorded successfully', 201);
  });

  public recordRefundOrAdjustment = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Manager',
    };

    const data = await shopFinanceService.recordRefundOrAdjustment(tenantId, user, req.body);
    ApiResponse.success(res, data, 'Refund or adjustment recorded successfully');
  });

  public getDailyCashRegister = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      fullName: req.user!.fullName || 'Studio Cashier',
    };

    const dateStr = req.query.date as string | undefined;
    const openingFloat = Number(req.query.openingFloat) || 0;

    const data = await shopFinanceService.getDailyCashRegister(tenantId, user, dateStr, openingFloat);
    ApiResponse.success(res, data, 'Daily cash register state retrieved successfully');
  });

  public closeDailyCashRegister = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const user = {
      id: req.user!.id,
      role: req.user!.role,
      fullName: req.user!.fullName || 'Studio Manager',
    };

    const { actualCountedCash, notes, dateStr } = req.body;
    if (actualCountedCash === undefined) {
      throw new BadRequestError('Actual counted cash is required to close the register.');
    }

    const data = await shopFinanceService.closeDailyCashRegister(tenantId, user, {
      actualCountedCash,
      notes,
      dateStr,
    });
    ApiResponse.success(res, data, 'Daily cash register closed and reconciled successfully');
  });

  public getFinancialReports = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await shopFinanceService.getFinancialReports(tenantId, req.query);
    ApiResponse.success(res, data, 'Financial reports generated successfully');
  });

  public listInventory = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const category = req.query.category as string | undefined;
    const data = await shopFinanceService.listInventory(tenantId, category);
    ApiResponse.success(res, data, 'Shop inventory items retrieved successfully');
  });

  public addOrUpdateInventory = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const data = await shopFinanceService.addOrUpdateInventory(tenantId, req.body);
    ApiResponse.success(res, data, 'Inventory item saved successfully');
  });
}

export const shopFinanceController = new ShopFinanceController();

