import mongoose from 'mongoose';
import {
  ShopTransaction,
  IShopTransaction,
  DailyCashRegister,
  IDailyCashRegister,
  ShopInventoryItem,
  IShopInventoryItem,
  ShopPaymentMethod,
  ShopTransactionType,
} from '../../models/ShopFinance.model';
import { Customer } from '../../models/Customer.model';
import { Job } from '../../models/Job.model';
import { Tenant } from '../../models/Tenant.model';
import { User } from '../../models/User.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../errors';

export class ShopFinanceService {
  /**
   * Helper: Resolve tenantId from string to ObjectId
   */
  private async resolveTenantId(tenantId: string | mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
    if (tenantId instanceof mongoose.Types.ObjectId) {
      return tenantId;
    }
    if (mongoose.Types.ObjectId.isValid(tenantId) && tenantId.length === 24) {
      return new mongoose.Types.ObjectId(tenantId);
    }
    const tenant = await Tenant.findOne({ subdomain: tenantId }).select('_id');
    if (!tenant) {
      throw new NotFoundError(`Tenant '${tenantId}' not found`);
    }
    return tenant._id as mongoose.Types.ObjectId;
  }

  /**
   * Helper: Safe currency rounding (2 decimal places, avoids floating-point errors)
   */
  private roundMoney(amount: number): number {
    return Math.round((Number(amount) || 0) * 100) / 100;
  }

  /**
   * Helper: Get current date formatted as YYYY-MM-DD (Asia/Dhaka timezone)
   */
  private getTodayDateString(): string {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  // ---------------------------------------------------------------------------
  // 1. POS & SALES RECORDING (IMMUTABLE TRANSACTION)
  // ---------------------------------------------------------------------------
  public async recordPOSSale(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    payload: {
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      jobId?: string;
      items: Array<{
        serviceType: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
      discount?: {
        amount: number;
        reason?: string;
      };
      paidAmount: number;
      paymentMethod: ShopPaymentMethod;
      staffId?: string;
      commissionRatePercent?: number;
      referenceNote?: string;
      idempotencyKey?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);

    // 1. Idempotency Check
    if (payload.idempotencyKey) {
      const existing = await ShopTransaction.findOne({
        tenantId,
        idempotencyKey: payload.idempotencyKey,
      });
      if (existing) {
        return {
          transaction: existing,
          isDuplicate: true,
          message: 'Existing transaction returned via idempotency key',
        };
      }
    }

    // 2. Validate Items & Financials
    if (!payload.items || payload.items.length === 0) {
      throw new BadRequestError('POS sale must contain at least one line item.');
    }

    let subtotal = 0;
    for (const item of payload.items) {
      const lineTotal = this.roundMoney(item.quantity * item.unitPrice);
      item.total = lineTotal;
      subtotal = this.roundMoney(subtotal + lineTotal);
    }

    const discountAmount = this.roundMoney(payload.discount?.amount || 0);
    const netAmount = this.roundMoney(Math.max(0, subtotal - discountAmount));
    const paidAmount = this.roundMoney(payload.paidAmount || 0);
    const dueAmount = this.roundMoney(Math.max(0, netAmount - paidAmount));

    // 3. Customer Linking & Due Update
    let customerDoc = null;
    if (payload.customerId) {
      customerDoc = await Customer.findOne({ _id: payload.customerId, tenantId });
    } else if (payload.customerPhone) {
      customerDoc = await Customer.findOne({ phone: payload.customerPhone, tenantId });
    }

    if (customerDoc) {
      customerDoc.totalOrdersCount = (customerDoc.totalOrdersCount || 0) + 1;
      customerDoc.totalSpent = this.roundMoney(customerDoc.totalSpent + paidAmount);
      if (dueAmount > 0) {
        customerDoc.dueBalance = this.roundMoney(customerDoc.dueBalance + dueAmount);
      }
      customerDoc.lastVisitAt = new Date();
      await customerDoc.save();
    }

    // 4. Staff Commission Calculation
    let staffCommission = undefined;
    if (payload.staffId) {
      const staffUser = await User.findOne({ _id: payload.staffId, tenantId });
      if (staffUser) {
        const rate = Number(payload.commissionRatePercent) || 0;
        const commAmount = this.roundMoney(netAmount * (rate / 100));
        staffCommission = {
          staffId: staffUser._id as mongoose.Types.ObjectId,
          staffName: staffUser.fullName,
          ratePercent: rate,
          amount: commAmount,
        };
      }
    }

    // 5. Generate Unique Transaction Code
    const txnCode = `TXN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 6. Create Transaction
    const transaction = await ShopTransaction.create({
      tenantId,
      transactionCode: txnCode,
      type: 'SALE',
      amount: paidAmount > 0 ? paidAmount : netAmount,
      paymentMethod: payload.paymentMethod || 'CASH',
      category: payload.items[0]?.serviceType || 'GENERAL',
      jobId: payload.jobId ? new mongoose.Types.ObjectId(payload.jobId) : undefined,
      customerId: customerDoc?._id as mongoose.Types.ObjectId | undefined,
      customerName: customerDoc?.fullName || payload.customerName || 'Walk-in Customer',
      customerPhone: customerDoc?.phone || payload.customerPhone,
      recordedBy: new mongoose.Types.ObjectId(user.id),
      recordedByName: user.fullName,
      recordedByRole: user.role,
      staffCommission,
      discount: discountAmount > 0 ? { amount: discountAmount, reason: payload.discount?.reason } : undefined,
      referenceNote: payload.referenceNote,
      idempotencyKey: payload.idempotencyKey,
      metadata: {
        items: payload.items,
        subtotal,
        discountAmount,
        netAmount,
        paidAmount,
        dueAmount,
      },
    });

    // 7. Update Job Status if linked
    if (payload.jobId) {
      const job = await Job.findOne({ _id: payload.jobId, tenantId });
      if (job) {
        job.paidAmount = this.roundMoney((job.paidAmount || 0) + paidAmount);
        if (job.paidAmount >= job.totalAmount) {
          job.paymentStatus = 'PAID';
        } else if (job.paidAmount > 0) {
          job.paymentStatus = 'PARTIAL';
        }
        await job.save();
      }
    }

    return {
      transaction,
      isDuplicate: false,
      invoice: {
        transactionCode: txnCode,
        customerName: customerDoc?.fullName || payload.customerName || 'Walk-in Customer',
        customerPhone: customerDoc?.phone || payload.customerPhone || 'N/A',
        items: payload.items,
        subtotal,
        discount: discountAmount,
        netAmount,
        paidAmount,
        dueAmount,
        customerOutstandingDue: customerDoc?.dueBalance || 0,
        paymentMethod: payload.paymentMethod,
        date: transaction.createdAt,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. CUSTOMER DUE PAYMENT COLLECTION
  // ---------------------------------------------------------------------------
  public async collectCustomerDue(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    payload: {
      customerId: string;
      amount: number;
      paymentMethod: ShopPaymentMethod;
      referenceNote?: string;
      idempotencyKey?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const amount = this.roundMoney(payload.amount);

    if (amount <= 0) {
      throw new BadRequestError('Payment collection amount must be greater than 0.');
    }

    // Idempotency check
    if (payload.idempotencyKey) {
      const existing = await ShopTransaction.findOne({
        tenantId,
        idempotencyKey: payload.idempotencyKey,
      });
      if (existing) {
        return { transaction: existing, isDuplicate: true };
      }
    }

    const customer = await Customer.findOne({ _id: payload.customerId, tenantId });
    if (!customer) {
      throw new NotFoundError('Customer not found for this tenant.');
    }

    if (customer.dueBalance <= 0) {
      throw new BadRequestError(`Customer '${customer.fullName}' has no outstanding due balance.`);
    }

    const oldDue = customer.dueBalance;
    const newDue = this.roundMoney(Math.max(0, customer.dueBalance - amount));
    customer.dueBalance = newDue;
    customer.totalSpent = this.roundMoney(customer.totalSpent + amount);
    customer.lastVisitAt = new Date();
    await customer.save();

    const txnCode = `COL-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transaction = await ShopTransaction.create({
      tenantId,
      transactionCode: txnCode,
      type: 'PAYMENT_COLLECTION',
      amount,
      paymentMethod: payload.paymentMethod || 'CASH',
      category: 'DUE_COLLECTION',
      customerId: customer._id as mongoose.Types.ObjectId,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      recordedBy: new mongoose.Types.ObjectId(user.id),
      recordedByName: user.fullName,
      recordedByRole: user.role,
      referenceNote: payload.referenceNote || `Collected due payment. Previous due: ৳${oldDue}, Remaining: ৳${newDue}`,
      idempotencyKey: payload.idempotencyKey,
      metadata: {
        previousDue: oldDue,
        collectedAmount: amount,
        remainingDue: newDue,
      },
    });

    return {
      transaction,
      previousDue: oldDue,
      amountCollected: amount,
      remainingDue: newDue,
      customerName: customer.fullName,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. SHOP EXPENSE TRACKING
  // ---------------------------------------------------------------------------
  public async recordExpense(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    payload: {
      amount: number;
      category: string;
      paymentMethod: ShopPaymentMethod;
      referenceNote: string;
      idempotencyKey?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const amount = this.roundMoney(payload.amount);

    if (amount <= 0) {
      throw new BadRequestError('Expense amount must be greater than 0.');
    }
    if (!payload.category) {
      throw new BadRequestError('Expense category is required (e.g. SHOP_RENT, ELECTRICITY, SUPPLIES).');
    }

    // Idempotency check
    if (payload.idempotencyKey) {
      const existing = await ShopTransaction.findOne({
        tenantId,
        idempotencyKey: payload.idempotencyKey,
      });
      if (existing) {
        return { transaction: existing, isDuplicate: true };
      }
    }

    const txnCode = `EXP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transaction = await ShopTransaction.create({
      tenantId,
      transactionCode: txnCode,
      type: 'EXPENSE',
      amount,
      paymentMethod: payload.paymentMethod || 'CASH',
      category: payload.category.toUpperCase().replace(/\s+/g, '_'),
      recordedBy: new mongoose.Types.ObjectId(user.id),
      recordedByName: user.fullName,
      recordedByRole: user.role,
      referenceNote: payload.referenceNote,
      idempotencyKey: payload.idempotencyKey,
    });

    return { transaction };
  }

  // ---------------------------------------------------------------------------
  // 4. REFUNDS & ADJUSTMENTS
  // ---------------------------------------------------------------------------
  public async recordRefundOrAdjustment(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    payload: {
      type: 'REFUND' | 'ADJUSTMENT';
      amount: number;
      jobId?: string;
      customerId?: string;
      paymentMethod: ShopPaymentMethod;
      reason: string;
      idempotencyKey?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const amount = this.roundMoney(payload.amount);

    if (amount <= 0) {
      throw new BadRequestError('Amount must be greater than 0.');
    }
    if (!payload.reason) {
      throw new BadRequestError('Reason is required for refunds and adjustments.');
    }

    const txnCode = `REF-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transaction = await ShopTransaction.create({
      tenantId,
      transactionCode: txnCode,
      type: payload.type || 'REFUND',
      amount,
      paymentMethod: payload.paymentMethod || 'CASH',
      category: 'REFUND_ADJUSTMENT',
      jobId: payload.jobId ? new mongoose.Types.ObjectId(payload.jobId) : undefined,
      customerId: payload.customerId ? new mongoose.Types.ObjectId(payload.customerId) : undefined,
      recordedBy: new mongoose.Types.ObjectId(user.id),
      recordedByName: user.fullName,
      recordedByRole: user.role,
      referenceNote: payload.reason,
      idempotencyKey: payload.idempotencyKey,
    });

    // Update job paymentStatus if refunded
    if (payload.jobId) {
      const job = await Job.findOne({ _id: payload.jobId, tenantId });
      if (job) {
        job.paymentStatus = 'REFUNDED';
        await job.save();
      }
    }

    return { transaction };
  }

  // ---------------------------------------------------------------------------
  // 5. DAILY CASH REGISTER & SHIFT CLOSING
  // ---------------------------------------------------------------------------
  public async getDailyCashRegister(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; fullName: string },
    dateStr?: string,
    openingFloat: number = 0
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const targetDate = dateStr || this.getTodayDateString();

    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    let register = await DailyCashRegister.findOne({ tenantId, closingDate: targetDate });
    if (!register) {
      register = await DailyCashRegister.create({
        tenantId,
        closingDate: targetDate,
        openedAt: new Date(),
        openedBy: new mongoose.Types.ObjectId(user.id),
        openedByName: user.fullName,
        openingFloat: this.roundMoney(openingFloat),
        status: 'OPEN',
      });
    }

    // Live Aggregation of Today's Transactions
    const txns = await ShopTransaction.find({
      tenantId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    let totalSales = 0;
    let cashSales = 0;
    let digitalSales = 0;
    let duesGiven = 0;
    let duesCollected = 0;
    let totalExpenses = 0;
    let cashExpenses = 0;

    for (const t of txns) {
      if (t.type === 'SALE') {
        const paid = this.roundMoney(t.amount);
        totalSales = this.roundMoney(totalSales + paid);
        if (t.paymentMethod === 'CASH') {
          cashSales = this.roundMoney(cashSales + paid);
        } else {
          digitalSales = this.roundMoney(digitalSales + paid);
        }
        if (t.metadata?.dueAmount) {
          duesGiven = this.roundMoney(duesGiven + t.metadata.dueAmount);
        }
      } else if (t.type === 'PAYMENT_COLLECTION') {
        duesCollected = this.roundMoney(duesCollected + t.amount);
        if (t.paymentMethod === 'CASH') {
          cashSales = this.roundMoney(cashSales + t.amount);
        }
      } else if (t.type === 'EXPENSE') {
        totalExpenses = this.roundMoney(totalExpenses + t.amount);
        if (t.paymentMethod === 'CASH') {
          cashExpenses = this.roundMoney(cashExpenses + t.amount);
        }
      } else if (t.type === 'REFUND') {
        if (t.paymentMethod === 'CASH') {
          cashExpenses = this.roundMoney(cashExpenses + t.amount);
        }
      }
    }

    const floatAmt = register.openingFloat || 0;
    const expectedCashInDrawer = this.roundMoney(floatAmt + cashSales - cashExpenses);

    register.summary = {
      totalSales,
      cashSales,
      digitalSales,
      duesGiven,
      duesCollected,
      totalExpenses,
      cashExpenses,
      expectedCashInDrawer,
      actualCountedCash: register.summary?.actualCountedCash,
      cashDifference: register.summary?.actualCountedCash !== undefined
        ? this.roundMoney(register.summary.actualCountedCash - expectedCashInDrawer)
        : 0,
    };

    if (register.status === 'OPEN') {
      await register.save();
    }

    return register;
  }

  public async closeDailyCashRegister(
    tenantIdInput: string | mongoose.Types.ObjectId,
    user: { id: string; role: string; fullName: string },
    payload: {
      actualCountedCash: number;
      notes?: string;
      dateStr?: string;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const targetDate = payload.dateStr || this.getTodayDateString();

    const register = await this.getDailyCashRegister(tenantId, user, targetDate);
    const countedCash = this.roundMoney(payload.actualCountedCash);
    const expected = register.summary.expectedCashInDrawer;
    const difference = this.roundMoney(countedCash - expected);

    register.status = 'CLOSED';
    register.closedAt = new Date();
    register.closedBy = new mongoose.Types.ObjectId(user.id);
    register.closedByName = user.fullName;
    register.summary.actualCountedCash = countedCash;
    register.summary.cashDifference = difference;
    if (payload.notes) register.notes = payload.notes;

    await register.save();
    return register;
  }

  // ---------------------------------------------------------------------------
  // 6. FINANCIAL REPORTING & AUDIT
  // ---------------------------------------------------------------------------
  public async getFinancialReports(
    tenantIdInput: string | mongoose.Types.ObjectId,
    query: { days?: number; startDate?: string; endDate?: string }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const days = Number(query.days) || 30;

    let startDate: Date;
    let endDate: Date = new Date();

    if (query.startDate) {
      startDate = new Date(query.startDate);
      if (query.endDate) endDate = new Date(query.endDate);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // 1. Overall Sales vs Expenses
    const [salesAgg, expensesAgg, dueCollAgg] = await Promise.all([
      ShopTransaction.aggregate([
        { $match: { tenantId, type: 'SALE', createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      ShopTransaction.aggregate([
        { $match: { tenantId, type: 'EXPENSE', createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      ShopTransaction.aggregate([
        { $match: { tenantId, type: 'PAYMENT_COLLECTION', createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalDueCollected: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalSales = salesAgg[0]?.totalSales || 0;
    const totalExpenses = expensesAgg[0]?.totalExpenses || 0;
    const totalDueCollected = dueCollAgg[0]?.totalDueCollected || 0;
    const netProfit = this.roundMoney(totalSales + totalDueCollected - totalExpenses);

    // 2. Service-Wise Revenue Breakdown
    const serviceRevenueRaw = await ShopTransaction.aggregate([
      { $match: { tenantId, type: 'SALE', createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$category',
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // 3. Payment Method Distribution
    const paymentMethodRaw = await ShopTransaction.aggregate([
      { $match: { tenantId, type: 'SALE', createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$paymentMethod',
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // 4. Outstanding Customer Dues (Top debtors)
    const topDebtors = await Customer.find({ tenantId, dueBalance: { $gt: 0 }, isDeleted: false })
      .sort({ dueBalance: -1 })
      .limit(10)
      .select('fullName phone dueBalance totalSpent lastVisitAt')
      .lean();

    const totalOutstandingDueAgg = await Customer.aggregate([
      { $match: { tenantId, dueBalance: { $gt: 0 }, isDeleted: false } },
      { $group: { _id: null, total: { $sum: '$dueBalance' } } },
    ]);
    const totalOutstandingDue = totalOutstandingDueAgg[0]?.total || 0;

    // 5. Staff Performance & Commission Report
    const staffPerformanceRaw = await ShopTransaction.aggregate([
      {
        $match: {
          tenantId,
          type: 'SALE',
          'staffCommission.staffId': { $exists: true, $ne: null },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$staffCommission.staffId',
          staffName: { $first: '$staffCommission.staffName' },
          totalSales: { $sum: '$amount' },
          totalCommission: { $sum: '$staffCommission.amount' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    // 6. Recent Expense Summary by Category
    const expenseByCategoryRaw = await ShopTransaction.aggregate([
      { $match: { tenantId, type: 'EXPENSE', createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return {
      period: { days, startDate, endDate },
      summary: {
        totalSales: this.roundMoney(totalSales),
        totalDueCollected: this.roundMoney(totalDueCollected),
        totalExpenses: this.roundMoney(totalExpenses),
        netProfit,
        totalOutstandingDue: this.roundMoney(totalOutstandingDue),
      },
      serviceRevenue: serviceRevenueRaw.map((s) => ({
        service: s._id,
        revenue: this.roundMoney(s.revenue),
        orders: s.orders,
      })),
      paymentMethods: paymentMethodRaw.map((p) => ({
        method: p._id,
        revenue: this.roundMoney(p.revenue),
        count: p.count,
      })),
      topDebtors,
      staffPerformance: staffPerformanceRaw.map((st) => ({
        staffId: st._id,
        staffName: st.staffName,
        totalSales: this.roundMoney(st.totalSales),
        totalCommission: this.roundMoney(st.totalCommission),
        ordersCount: st.ordersCount,
      })),
      expenseBreakdown: expenseByCategoryRaw.map((e) => ({
        category: e._id,
        total: this.roundMoney(e.total),
        count: e.count,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 7. INVENTORY MANAGEMENT (OPTIONAL / CONSUMABLES)
  // ---------------------------------------------------------------------------
  public async listInventory(tenantIdInput: string | mongoose.Types.ObjectId, category?: string) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const filter: Record<string, any> = { tenantId, isActive: true };
    if (category) filter.category = category;

    return ShopInventoryItem.find(filter).sort({ stockQuantity: 1 });
  }

  public async addOrUpdateInventory(
    tenantIdInput: string | mongoose.Types.ObjectId,
    payload: {
      itemCode: string;
      name: string;
      category: 'PAPER' | 'INK_TONER' | 'LAMINATION' | 'STATIONERY' | 'OTHER';
      unit: 'PACK' | 'SHEET' | 'BOTTLE' | 'PIECE' | 'ROLL';
      costPrice: number;
      sellingPrice?: number;
      stockQuantity: number;
      lowStockThreshold?: number;
    }
  ) {
    const tenantId = await this.resolveTenantId(tenantIdInput);
    const itemCode = payload.itemCode.toUpperCase().trim();

    let item = await ShopInventoryItem.findOne({ tenantId, itemCode });
    if (item) {
      item.name = payload.name;
      item.category = payload.category;
      item.unit = payload.unit;
      item.costPrice = this.roundMoney(payload.costPrice);
      if (payload.sellingPrice !== undefined) item.sellingPrice = this.roundMoney(payload.sellingPrice);
      item.stockQuantity = payload.stockQuantity;
      if (payload.lowStockThreshold !== undefined) item.lowStockThreshold = payload.lowStockThreshold;
      item.lastRestockedAt = new Date();
      await item.save();
    } else {
      item = await ShopInventoryItem.create({
        tenantId,
        itemCode,
        name: payload.name,
        category: payload.category,
        unit: payload.unit,
        costPrice: this.roundMoney(payload.costPrice),
        sellingPrice: payload.sellingPrice !== undefined ? this.roundMoney(payload.sellingPrice) : undefined,
        stockQuantity: payload.stockQuantity,
        lowStockThreshold: payload.lowStockThreshold || 5,
        lastRestockedAt: new Date(),
        isActive: true,
      });
    }

    return item;
  }
}

export const shopFinanceService = new ShopFinanceService();

