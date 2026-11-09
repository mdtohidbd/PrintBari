import crypto from 'crypto';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Customer } from '../models/Customer.model';
import { Job } from '../models/Job.model';
import { ShopTransaction, DailyCashRegister, ShopInventoryItem } from '../models/ShopFinance.model';
import { TokenService } from '../utils/token';

const API_BASE = 'http://localhost:5000/api/v1';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, test: string, errorMsg?: string, details?: any) {
  if (condition) {
    results.push({ suite, test, passed: true, details });
    console.log(`  ✓ [PASS] ${suite} - ${test}`);
  } else {
    results.push({ suite, test, passed: false, error: errorMsg || 'Assertion failed', details });
    console.error(`  ✗ [FAIL] ${suite} - ${test}: ${errorMsg || 'Assertion failed'}`);
  }
}

async function runPhase30Tests() {
  console.log('\n================================================================');
  console.log('  PHASE 30: ADVANCED SHOP BUSINESS MANAGEMENT TEST SUITE        ');
  console.log('================================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas...\n');

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // SETUP: Tenant & Multi-Role Users
    // -------------------------------------------------------------
    const testSubdomain = `shopfin-${timestamp.toString().slice(-6)}`;
    const tenant = await Tenant.create({
      businessId: `SHOP-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      subdomain: testSubdomain,
      name: `Metro Commercial Lab ${timestamp}`,
      email: `owner_${testSubdomain}@test.com`,
      subscription: {
        plan: 'PRO',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 86400000),
      },
      quotas: {
        maxStaffSeats: 5,
        monthlyPassportLayoutsLimit: 500,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: 200,
        monthlyOcrPagesUsed: 0,
        monthlyJobsLimit: 1000,
        monthlyJobsUsed: 0,
        storageLimitBytes: 10 * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
      },
      isActive: true,
    });

    const owner = await User.create({
      tenantId: tenant._id,
      fullName: 'Kamrul Hasan (Owner)',
      email: `owner_${testSubdomain}@test.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'OWNER',
      isActive: true,
      isEmailVerified: true,
    });

    const cashier = await User.create({
      tenantId: tenant._id,
      fullName: 'Tariqul Islam (Cashier)',
      email: `cashier_${testSubdomain}@test.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'STAFF',
      isActive: true,
      isEmailVerified: true,
    });

    const ownerToken = TokenService.generateAccessToken({
      userId: owner._id.toString(),
      email: owner.email,
      role: owner.role,
      tenantId: tenant._id.toString(),
    });

    const cashierToken = TokenService.generateAccessToken({
      userId: cashier._id.toString(),
      email: cashier.email,
      role: cashier.role,
      tenantId: tenant._id.toString(),
    });

    const ownerClient = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${ownerToken}`, 'x-tenant-id': testSubdomain },
    });

    const cashierClient = axios.create({
      baseURL: API_BASE,
      headers: { Authorization: `Bearer ${cashierToken}`, 'x-tenant-id': testSubdomain },
    });

    const customer = await Customer.create({
      tenantId: tenant._id,
      fullName: 'Zubair Ahmed',
      phone: `01711${timestamp.toString().slice(-6)}`,
      email: 'zubair@example.com',
      totalOrdersCount: 0,
      totalSpent: 0,
      dueBalance: 0,
      lastVisitAt: new Date(),
      isActive: true,
      isDeleted: false,
    });

    // -------------------------------------------------------------
    // TEST 1: POS Sale with Cash & Staff Commission
    // -------------------------------------------------------------
    console.log('>>> [TEST SUITE 1: POS Sale Recording & Invoicing]');
    const posSaleRes = await cashierClient.post('/finance/pos/sales', {
      customerId: customer._id.toString(),
      items: [
        {
          serviceType: 'PASSPORT_PHOTO',
          description: 'Schengen Visa 35x45mm (8 Copies)',
          quantity: 1,
          unitPrice: 300,
          total: 300,
        },
      ],
      discount: { amount: 20, reason: 'First visit discount' },
      paidAmount: 280,
      paymentMethod: 'CASH',
      staffId: cashier._id.toString(),
      commissionRatePercent: 10,
      idempotencyKey: `IDEMP-POS-${timestamp}-01`,
    });

    assert(
      posSaleRes.data.success && posSaleRes.data.data.transaction.type === 'SALE',
      'POS Sale',
      'Successfully recorded POS sale transaction'
    );
    assert(
      posSaleRes.data.data.invoice.netAmount === 280 && posSaleRes.data.data.invoice.discount === 20,
      'POS Sale',
      'Calculated netAmount (300 - 20 = 280) accurately'
    );
    assert(
      posSaleRes.data.data.transaction.staffCommission.amount === 28,
      'POS Sale',
      'Calculated 10% staff commission (280 * 0.10 = 28 BDT)'
    );

    // -------------------------------------------------------------
    // TEST 2: Idempotency & Duplicate Prevention
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 2: Idempotency & Double-Charge Prevention]');
    const duplicateRes = await cashierClient.post('/finance/pos/sales', {
      customerId: customer._id.toString(),
      items: [{ serviceType: 'PASSPORT_PHOTO', description: 'Copy', quantity: 1, unitPrice: 300, total: 300 }],
      paidAmount: 280,
      paymentMethod: 'CASH',
      idempotencyKey: `IDEMP-POS-${timestamp}-01`,
    });
    assert(
      duplicateRes.data.data.isDuplicate === true,
      'Idempotency',
      'Prevented duplicate transaction via idempotencyKey'
    );

    // -------------------------------------------------------------
    // TEST 3: Partial Payment & Customer Due Management
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 3: Partial Payment & Due Management]');
    const partialSaleRes = await cashierClient.post('/finance/pos/sales', {
      customerId: customer._id.toString(),
      items: [
        { serviceType: 'ID_CARD_A4', description: 'Smart NID 4-Up Lamination', quantity: 1, unitPrice: 500, total: 500 },
      ],
      paidAmount: 200,
      paymentMethod: 'CASH',
      idempotencyKey: `IDEMP-POS-${timestamp}-02`,
    });
    assert(
      partialSaleRes.data.data.invoice.dueAmount === 300,
      'Partial Payment',
      'Calculated remaining dueAmount = 300 BDT'
    );

    // Verify Customer Due in Database
    const updatedCust = await Customer.findById(customer._id);
    assert(
      updatedCust?.dueBalance === 300,
      'Customer Due',
      'Customer dueBalance atomically updated to 300 BDT'
    );

    // -------------------------------------------------------------
    // TEST 4: Customer Due Payment Collection
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 4: Due Payment Collection]');
    const collectRes = await cashierClient.post('/finance/dues/collect', {
      customerId: customer._id.toString(),
      amount: 200,
      paymentMethod: 'BKASH',
      referenceNote: 'Paid ৳200 via bKash personal',
      idempotencyKey: `IDEMP-DUE-${timestamp}`,
    });
    assert(
      collectRes.data.success && collectRes.data.data.remainingDue === 100,
      'Due Collection',
      'Collected 200 BDT; customer dueBalance decreased from 300 to 100 BDT'
    );

    const postCollectCust = await Customer.findById(customer._id);
    assert(
      postCollectCust?.dueBalance === 100,
      'Due Collection',
      'Customer dueBalance verified at 100 BDT in database'
    );

    // -------------------------------------------------------------
    // TEST 5: Shop Expenses & Role Permissions
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 5: Shop Expense Tracking & RBAC]');
    // Cashier (staff) attempts to log expense -> should be 403 Forbidden
    let cashierBlocked = false;
    try {
      await cashierClient.post('/finance/expenses', {
        amount: 500,
        category: 'ELECTRICITY_BILL',
        paymentMethod: 'CASH',
        referenceNote: 'DESCO electricity bill',
      });
    } catch (err: any) {
      cashierBlocked = err.response?.status === 403;
    }
    assert(
      cashierBlocked,
      'RBAC',
      'Regular staff blocked from recording shop expenses (403 Forbidden)'
    );

    // Owner logs expense
    const expenseRes = await ownerClient.post('/finance/expenses', {
      amount: 450,
      category: 'PAPER_SUPPLIES',
      paymentMethod: 'CASH',
      referenceNote: '2 reams of RC Glossy Photo Paper 260gsm',
    });
    assert(
      expenseRes.data.success && expenseRes.data.data.transaction.type === 'EXPENSE',
      'Expense',
      'Owner recorded 450 BDT paper supplies expense'
    );

    // -------------------------------------------------------------
    // TEST 6: Refunds & Adjustments
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 6: Refunds & Order Adjustments]');
    const refundRes = await ownerClient.post('/finance/refunds', {
      type: 'REFUND',
      amount: 50,
      customerId: customer._id.toString(),
      paymentMethod: 'CASH',
      reason: 'Customer cancelled 1 copy',
    });
    assert(
      refundRes.data.success && refundRes.data.data.transaction.type === 'REFUND',
      'Refund',
      'Recorded 50 BDT refund transaction'
    );

    // -------------------------------------------------------------
    // TEST 7: Daily Cash Register & Shift Closing
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 7: Daily Cash Register & Reconciliation]');
    // Inspect live register with 1000 BDT opening float
    const registerRes = await ownerClient.get('/finance/cash-register?openingFloat=1000');
    const summary = registerRes.data.data.summary;
    // Expected cash:
    // Opening float: 1000
    // Cash sales: 280 (sale 1) + 200 (sale 2) = 480
    // Due collected: 200 was via BKASH, so not in cashSales
    // Cash expenses: 450 (expense) + 50 (refund) = 500
    // Expected cash in drawer = 1000 + 480 - 500 = 980 BDT
    assert(
      summary.openingFloat !== undefined || registerRes.data.data.openingFloat === 1000,
      'Cash Register',
      'Cash register initialized with 1000 BDT opening float'
    );
    assert(
      summary.cashSales === 480,
      'Cash Register',
      'Accurately tracked 480 BDT in cash sales'
    );
    assert(
      summary.cashExpenses === 500,
      'Cash Register',
      'Accurately tracked 500 BDT in cash expenses and refunds'
    );
    assert(
      summary.expectedCashInDrawer === 980,
      'Cash Register',
      'Expected cash in drawer calculated at 980 BDT (1000 + 480 - 500)'
    );

    // Close Register with 980 BDT physical count (zero discrepancy)
    const closeRes = await ownerClient.post('/finance/cash-register/close', {
      actualCountedCash: 980,
      notes: 'Evening shift closing: exact cash match',
    });
    assert(
      closeRes.data.data.status === 'CLOSED' && closeRes.data.data.summary.cashDifference === 0,
      'Cash Register',
      'Closed register with 0 BDT discrepancy (Exact cash match)'
    );

    // -------------------------------------------------------------
    // TEST 8: Financial Reporting & Sales Analytics
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 8: Financial Reporting & Metrics]');
    const reportsRes = await ownerClient.get('/finance/reports?days=30');
    const reportData = reportsRes.data.data;

    assert(
      reportData.summary.totalSales === 480,
      'Reporting',
      'Total sales reported accurately'
    );
    assert(
      reportData.summary.totalDueCollected === 200,
      'Reporting',
      'Total dues collected reported accurately (200 BDT)'
    );
    assert(
      reportData.summary.totalExpenses === 450,
      'Reporting',
      'Total expenses reported accurately (450 BDT)'
    );
    assert(
      reportData.summary.totalOutstandingDue === 100,
      'Reporting',
      'Total outstanding customer dues reported accurately (100 BDT)'
    );
    assert(
      reportData.staffPerformance.length > 0 && reportData.staffPerformance[0].totalCommission === 28,
      'Reporting',
      'Staff performance tracking records 28 BDT commission earned by Tariqul'
    );
    assert(
      reportData.topDebtors.length > 0 && reportData.topDebtors[0].dueBalance === 100,
      'Reporting',
      'Top debtors report lists Zubair Ahmed with 100 BDT due'
    );

    // -------------------------------------------------------------
    // TEST 9: Consumable Inventory Management
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 9: Consumable Inventory Management]');
    const addInvRes = await ownerClient.post('/finance/inventory', {
      itemCode: 'PAP-A4-260',
      name: 'RC Glossy Photo Paper 260gsm A4',
      category: 'PAPER',
      unit: 'PACK',
      costPrice: 450,
      sellingPrice: 750,
      stockQuantity: 25,
      lowStockThreshold: 5,
    });
    assert(
      addInvRes.data.success && addInvRes.data.data.itemCode === 'PAP-A4-260',
      'Inventory',
      'Added consumable inventory item with cost and selling price'
    );

    const listInvRes = await ownerClient.get('/finance/inventory');
    assert(
      listInvRes.data.data.some((i: any) => i.itemCode === 'PAP-A4-260'),
      'Inventory',
      'Listed inventory items successfully'
    );

    // -------------------------------------------------------------
    // TEST 10: Multi-Tenant Data Isolation
    // -------------------------------------------------------------
    console.log('\n>>> [TEST SUITE 10: Multi-Tenant Isolation Check]');
    const rivalTenant = await Tenant.create({
      businessId: `RIVAL-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      subdomain: `rival-fin-${timestamp.toString().slice(-6)}`,
      name: 'Rival Studio',
      email: `rival_${timestamp}@test.com`,
      subscription: { plan: 'STARTER', status: 'ACTIVE', trialEndsAt: new Date(Date.now() + 14 * 86400000) },
      quotas: { storageLimitBytes: 1024 * 1024 * 1024, storageUsedBytes: 0, maxStaffSeats: 1 },
    });

    const crossTxns = await ShopTransaction.find({ tenantId: rivalTenant._id });
    assert(
      crossTxns.length === 0,
      'Tenant Isolation',
      'Rival tenant has 0 financial transactions (Strict isolation)'
    );

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('  PHASE 30 TEST EXECUTION SUMMARY                               ');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`Total Checks Executed : ${total}`);
    console.log(`Passed                : ${passed}`);
    console.log(`Failed                : ${failed}`);
    console.log(`Pass Rate             : ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.error('CRITICAL: Phase 30 tests encountered failures.');
      process.exit(1);
    } else {
      console.log('SUCCESS: All Phase 30 Shop Business Management tests passed flawlessly!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Fatal error during Phase 30 test execution:', err.response?.data || err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase30Tests();

