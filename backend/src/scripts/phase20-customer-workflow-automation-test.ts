import crypto from 'crypto';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import axios, { AxiosInstance } from 'axios';
import mongoose from 'mongoose';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Customer } from '../models/Customer.model';
import { Job } from '../models/Job.model';
import { Notification } from '../models/Notification.model';
import { TokenService } from '../utils/token';
import { automationEventBus } from '../services/automationEventBus';

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

async function runPhase20Tests() {
  console.log('\n======================================================');
  console.log('  PHASE 20: CUSTOMER EXPERIENCE & WORKFLOW AUTOMATION ');
  console.log('======================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas for setup...\n');

  try {
    const timestamp = Date.now();
    const testTenantSlug = `p20-test-shop-${timestamp}`;
    const testPhone = `01799${timestamp.toString().slice(-6)}`;

    // 1. Create Test Tenant
    const businessId = `SHOP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const subdomain = `p20-${timestamp.toString().slice(-6)}`;

    const tenant = await Tenant.create({
      businessId,
      subdomain,
      name: `Phase 20 Studio ${timestamp}`,
      ownerEmail: `owner_${timestamp}@p20.com`,
      subscription: {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 86400000),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
      quotas: {
        maxStaffSeats: 10,
        monthlyJobsLimit: 1000,
        monthlyJobsUsed: 0,
        monthlyPassportLayoutsLimit: 500,
        monthlyPassportLayoutsUsed: 0,
        monthlyOcrPagesLimit: 1000,
        monthlyOcrPagesUsed: 0,
        storageLimitBytes: 10 * 1024 * 1024 * 1024,
        storageUsedBytes: 0,
      },
      isActive: true,
    });

    // 2. Create Multi-Role Staff Accounts
    // 2a. Owner
    const ownerUser = await User.create({
      tenantId: tenant._id,
      fullName: 'Farhan Owner',
      email: `owner_${timestamp}@p20.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OWNER',
      phone: `01711${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // 2b. Manager
    const managerUser = await User.create({
      tenantId: tenant._id,
      fullName: 'Rahim Manager',
      email: `manager_${timestamp}@p20.com`,
      passwordHash: 'hashed_pw_test',
      role: 'MANAGER',
      phone: `01722${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // 2c. Operator
    const operatorUser = await User.create({
      tenantId: tenant._id,
      fullName: 'Karim Operator',
      email: `operator_${timestamp}@p20.com`,
      passwordHash: 'hashed_pw_test',
      role: 'OPERATOR',
      phone: `01733${timestamp.toString().slice(-6)}`,
      isActive: true,
    });

    // 3. Setup Axios Clients with Auth
    const createClient = (user: any): AxiosInstance => {
      const token = TokenService.generateAccessToken({
        userId: user._id.toString(),
        tenantId: tenant._id.toString(),
        role: user.role,
        email: user.email,
      });

      return axios.create({
        baseURL: API_BASE,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenant._id.toString(),
        },
      });
    };

    const ownerClient = createClient(ownerUser);
    const managerClient = createClient(managerUser);
    const operatorClient = createClient(operatorUser);

    console.log('--- TEST SUITE 1: Fast Customer Search & Profile Management ---');
    // 1. Create a Customer
    const custCreateRes = await operatorClient.post('/customers', {
      fullName: 'Tanvir Ahmed Customer',
      phone: testPhone,
      email: `tanvir_${timestamp}@gmail.com`,
      address: 'House 42, Road 11, Dhanmondi, Dhaka',
      notes: 'VIP customer, prefers glossy photo paper',
    });

    assert(custCreateRes.status === 201, 'Customer Management', 'Create Customer returns 201 Created');
    const customerId = custCreateRes.data.data._id;
    assert(!!customerId, 'Customer Management', 'Customer created with unique ID');

    // 2. Fast Lookup by Exact Mobile Phone
    const lookupExactRes = await operatorClient.get(`/customers/lookup?phone=${testPhone}`);
    assert(lookupExactRes.status === 200, 'Fast Customer Search', 'Exact phone lookup returns 200 OK');
    assert(lookupExactRes.data.data.found === true, 'Fast Customer Search', 'Found flag is true');
    assert(lookupExactRes.data.data.customer.fullName === 'Tanvir Ahmed Customer', 'Fast Customer Search', 'Customer name matched accurately');

    // 3. Fast Lookup by Partial Phone / Name Query
    const lookupPartialRes = await operatorClient.get(`/customers/lookup?query=${testPhone.slice(-4)}`);
    assert(lookupPartialRes.status === 200, 'Fast Customer Search', 'Partial query lookup returns 200 OK');
    assert(lookupPartialRes.data.data.found === true, 'Fast Customer Search', 'Partial lookup found customer');

    // 4. Customer Profile Retrieval with Recent Jobs Container
    const getCustRes = await operatorClient.get(`/customers/${customerId}`);
    assert(getCustRes.status === 200, 'Customer Management', 'Get customer profile returns 200 OK');
    assert(getCustRes.data.data.notes === 'VIP customer, prefers glossy photo paper', 'Customer Management', 'Customer notes preserved');
    assert(Array.isArray(getCustRes.data.data.recentJobs), 'Customer Management', 'Customer recentJobs returned as array');

    console.log('\n--- TEST SUITE 2: Customer Document Library & Reuse ---');
    // 5. Add Document to Customer File Library
    const addFileRes = await operatorClient.post(`/customers/${customerId}/files`, {
      name: 'Tanvir_Passport_Original.jpg',
      url: 'https://storage.docustudio.test/uploads/tanvir-pass-orig.jpg',
      size: 2450000,
      mimeType: 'image/jpeg',
      sourceJobCode: 'INIT-SCAN',
    });
    assert(addFileRes.status === 201, 'Document Library', 'Add customer file returns 201 Created');
    const customerFileId = addFileRes.data.data.fileId;
    assert(!!customerFileId, 'Document Library', 'Customer file created with fileId');

    // 6. List Customer Files
    const listFilesRes = await operatorClient.get(`/customers/${customerId}/files`);
    assert(listFilesRes.status === 200, 'Document Library', 'List customer files returns 200 OK');
    assert(listFilesRes.data.data.length >= 1, 'Document Library', 'Customer file library contains added document');
    assert(listFilesRes.data.data[0].name === 'Tanvir_Passport_Original.jpg', 'Document Library', 'File name verified');

    console.log('\n--- TEST SUITE 3: Job Workflow, Assignment & Event Automation ---');
    // 7. Create Job with Reused Customer File
    const jobCreateRes = await operatorClient.post('/jobs', {
      customerId,
      customerName: 'Tanvir Ahmed Customer',
      customerPhone: testPhone,
      serviceType: 'PASSPORT_PHOTO',
      copies: 8,
      paperType: 'A4 Matte Photo Paper',
      price: {
        subtotal: 200,
        discount: 20,
        tax: 0,
        totalPrice: 180,
      },
      paidAmount: 180,
      uploadedFiles: [
        {
          fileId: customerFileId,
          name: 'Tanvir_Passport_Original.jpg',
          url: 'https://storage.docustudio.test/uploads/tanvir-pass-orig.jpg',
          size: 2450000,
          mimeType: 'image/jpeg',
        },
      ],
      notes: 'Customer reused previously archived photo from library',
    });

    assert(jobCreateRes.status === 201, 'Job Workflow', 'Create Job with library file returns 201 Created');
    const job = jobCreateRes.data.data;
    const jobId = job._id;
    const jobCode = job.jobCode;
    assert(job.paymentStatus === 'PAID', 'Job Workflow', 'Payment status automatically marked PAID');

    // Wait 150ms for background event bus processing
    await new Promise((r) => setTimeout(r, 150));

    // 8. Verify EventBus triggered JOB_CREATED notification
    const initialNotifsRes = await operatorClient.get('/notifications');
    assert(initialNotifsRes.status === 200, 'Event Automation', 'List notifications returns 200 OK');
    const orderNotif = initialNotifsRes.data.data.notifications.find((n: any) => n.data?.jobCode === jobCode);
    assert(!!orderNotif, 'Event Automation', 'Automated in-app notification generated for JOB_CREATED');

    // 9. Job Assignment to Operator with Due Date & Priority
    const dueDate = new Date(Date.now() + 2 * 3600000).toISOString();
    const assignRes = await managerClient.put(`/jobs/${jobId}/assign`, {
      assignedTo: operatorUser._id.toString(),
      dueDate,
      priority: 'URGENT',
    });
    assert(assignRes.status === 200, 'Job Workflow', 'Assign job to operator returns 200 OK');
    assert(assignRes.data.data.priority === 'URGENT', 'Job Workflow', 'Job priority updated to URGENT');
    assert(!!assignRes.data.data.dueDate, 'Job Workflow', 'Job dueDate successfully recorded');

    // Wait 150ms for event bus
    await new Promise((r) => setTimeout(r, 150));

    // 10. Check Operator Received Assignment Notification
    const operatorNotifs = await operatorClient.get('/notifications');
    const assignedNotif = operatorNotifs.data.data.notifications.find(
      (n: any) => n.category === 'JOB_EVENT' && n.title.includes('Job Assigned')
    );
    assert(!!assignedNotif, 'Event Automation', 'Operator received JOB_ASSIGNED notification');

    // 11. Add Internal Comments to Job Order
    const commentRes = await operatorClient.post(`/jobs/${jobId}/comments`, {
      text: 'Original background has slight shadows. Replaced background with clean white preset.',
    });
    assert(commentRes.status === 201, 'Internal Comments', 'Post comment returns 201 Created');
    assert(commentRes.data.data.userName === 'Karim Operator', 'Internal Comments', 'Comment author recorded accurately');

    const getCommentsRes = await operatorClient.get(`/jobs/${jobId}/comments`);
    assert(getCommentsRes.status === 200, 'Internal Comments', 'Get comments returns 200 OK');
    assert(getCommentsRes.data.data.length >= 1, 'Internal Comments', 'Internal comments list contains posted entry');

    // 12. Submit Job for Review (assignReviewer)
    const reviewReqRes = await operatorClient.put(`/jobs/${jobId}/reviewer`, {
      reviewerId: managerUser._id.toString(),
      note: 'Finished 8-up layout. Ready for quality review before printing.',
    });
    assert(reviewReqRes.status === 200, 'Review Workflow', 'Submit for review returns 200 OK');
    assert(reviewReqRes.data.data.status === 'READY_FOR_REVIEW', 'Review Workflow', 'Job status is READY_FOR_REVIEW');
    assert(reviewReqRes.data.data.reviewerName === 'Rahim Manager', 'Review Workflow', 'Reviewer name assigned');

    // Wait 150ms for event bus
    await new Promise((r) => setTimeout(r, 150));

    // 13. Check Manager Received Review Notification
    const managerNotifs = await managerClient.get('/notifications');
    const reviewNotif = managerNotifs.data.data.notifications.find(
      (n: any) => n.title.includes('Review Requested')
    );
    assert(!!reviewNotif, 'Event Automation', 'Manager received JOB_READY_FOR_REVIEW notification');

    // 14. Manager Approves Job
    const approveRes = await managerClient.put(`/jobs/${jobId}/approve`, {
      note: 'DPI and alignment checked. Quality approved for printing.',
    });
    assert(approveRes.status === 200, 'Review Workflow', 'Approve job returns 200 OK');
    assert(approveRes.data.data.status === 'APPROVED', 'Review Workflow', 'Job status updated to APPROVED');

    // 15. Complete Job Order
    const completeRes = await operatorClient.patch(`/jobs/${jobId}/status`, {
      status: 'COMPLETED',
      note: 'All 8 passport photo copies printed and packed in protective pouch.',
    });
    assert(completeRes.status === 200, 'Job Workflow', 'Complete job returns 200 OK');
    assert(completeRes.data.data.status === 'COMPLETED', 'Job Workflow', 'Job status is COMPLETED');
    assert(!!completeRes.data.data.completedAt, 'Job Workflow', 'Completed timestamp recorded');

    // Wait 150ms for event bus
    await new Promise((r) => setTimeout(r, 150));

    // 16. Verify SMS notification was dispatched for Customer
    const smsNotif = await Notification.findOne({
      tenantId: tenant._id,
      customerPhone: testPhone,
      type: 'SMS',
    });
    assert(!!smsNotif, 'Event Automation', 'Customer SMS notification created on JOB_COMPLETED');
    assert(smsNotif?.deliveryStatus === 'DELIVERED', 'Event Automation', 'Customer SMS delivery status is DELIVERED');

    console.log('\n--- TEST SUITE 4: Cancellation Reason & Permission Guarded Reopening ---');
    // 17. Attempt to Cancel Without Cancellation Reason -> Must Fail
    let cancelErrorCaptured = false;
    try {
      await operatorClient.patch(`/jobs/${jobId}/status`, {
        status: 'CANCELLED',
      });
    } catch (err: any) {
      cancelErrorCaptured = true;
      assert(err.response?.status === 400, 'Cancellation Rules', 'Cancellation without reason rejected with 400 Bad Request');
    }
    assert(cancelErrorCaptured, 'Cancellation Rules', 'Validation caught missing cancellation reason');

    // 18. Cancel With Reason -> Succeeds
    const cancelRes = await managerClient.patch(`/jobs/${jobId}/status`, {
      status: 'CANCELLED',
      cancellationReason: 'Customer requested cancellation due to wrong visa spec requirement',
    });
    assert(cancelRes.status === 200, 'Cancellation Rules', 'Cancellation with reason succeeded');
    assert(cancelRes.data.data.status === 'CANCELLED', 'Cancellation Rules', 'Job status updated to CANCELLED');
    assert(cancelRes.data.data.cancellationReason.includes('visa spec'), 'Cancellation Rules', 'Cancellation reason saved');

    // 19. Operator Attempts to Reopen Job -> Must Fail (Forbidden)
    let reopenForbidden = false;
    try {
      await operatorClient.patch(`/jobs/${jobId}/status`, {
        status: 'PROCESSING',
        note: 'Operator attempting unauthorized reopen',
      });
    } catch (err: any) {
      reopenForbidden = true;
      assert(err.response?.status === 403, 'Permission Guard', 'Operator reopening cancelled job rejected with 403 Forbidden');
    }
    assert(reopenForbidden, 'Permission Guard', 'Reopen permission strictly enforced on backend');

    // 20. Owner Reopens Job -> Allowed
    const ownerReopenRes = await ownerClient.patch(`/jobs/${jobId}/status`, {
      status: 'PROCESSING',
      note: 'Owner authorized job reopen after customer changed visa specs',
    });
    assert(ownerReopenRes.status === 200, 'Permission Guard', 'Owner authorized to reopen job (200 OK)');
    assert(ownerReopenRes.data.data.status === 'PROCESSING', 'Permission Guard', 'Job status successfully reopened to PROCESSING');

    console.log('\n--- TEST SUITE 5: Staff Experience & Productivity Metrics ---');
    // 21. Staff Assigned Jobs Queue (`/my-jobs`)
    const myJobsRes = await operatorClient.get('/jobs/my-jobs');
    assert(myJobsRes.status === 200, 'Staff Experience', 'Get my-jobs returns 200 OK');
    assert(Array.isArray(myJobsRes.data.data.pending), 'Staff Experience', 'Pending queue returned');
    assert(typeof myJobsRes.data.data.counts.total === 'number', 'Staff Experience', 'Total assigned jobs count returned');

    // 22. Staff Productivity Metrics (`/staff-metrics`)
    const staffMetricsRes = await operatorClient.get('/jobs/staff-metrics');
    assert(staffMetricsRes.status === 200, 'Staff Experience', 'Get staff-metrics returns 200 OK');
    assert(typeof staffMetricsRes.data.data.totalAssigned === 'number', 'Staff Experience', 'totalAssigned count present');
    assert(typeof staffMetricsRes.data.data.completionRatePercent === 'number', 'Staff Experience', 'completionRatePercent calculated');

    console.log('\n--- TEST SUITE 6: Customer Activity Timeline Aggregation ---');
    // 23. Complete Activity Timeline
    const custActivityRes = await operatorClient.get(`/customers/${customerId}/activity`);
    assert(custActivityRes.status === 200, 'Customer Activity', 'Get customer activity returns 200 OK');
    const { activityCount, activities } = custActivityRes.data.data;
    assert(activityCount >= 2, 'Customer Activity', `Customer activity returned ${activityCount} aggregated events`);
    const jobActivity = activities.find((a: any) => a.type === 'JOB');
    const fileActivity = activities.find((a: any) => a.type === 'FILE');
    assert(!!jobActivity, 'Customer Activity', 'Job order event aggregated into customer timeline');
    assert(!!fileActivity, 'Customer Activity', 'Document library upload event aggregated into customer timeline');

    console.log('\n--- TEST SUITE 7: Notification Deduplication & Read Status ---');
    // 24. Test Idempotency: Trigger same event again with duplicate idempotencyKey
    const testIdempotencyKey = `IDEMP_TEST_${timestamp}`;
    await automationEventBus.createNotificationSafe({
      tenantId: tenant._id,
      recipientId: operatorUser._id,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: 'Idempotency Test 1',
      message: 'Initial message',
      idempotencyKey: testIdempotencyKey,
    });

    const notifCountBefore = await Notification.countDocuments({ idempotencyKey: testIdempotencyKey });
    assert(notifCountBefore === 1, 'Idempotency', 'First notification created');

    // Dispatch identical event
    await automationEventBus.createNotificationSafe({
      tenantId: tenant._id,
      recipientId: operatorUser._id,
      type: 'IN_APP',
      category: 'JOB_EVENT',
      title: 'Idempotency Test 2',
      message: 'Duplicate message should be skipped',
      idempotencyKey: testIdempotencyKey,
    });

    const notifCountAfter = await Notification.countDocuments({ idempotencyKey: testIdempotencyKey });
    assert(notifCountAfter === 1, 'Idempotency', 'Duplicate notification safely prevented by idempotency key');

    // 25. Mark Single Notification as Read
    const unreadNotif = await Notification.findOne({ tenantId: tenant._id, isRead: false });
    assert(!!unreadNotif, 'Notifications', 'Found unread notification for read test');
    const markReadRes = await operatorClient.patch(`/notifications/${unreadNotif!._id}/read`);
    assert(markReadRes.status === 200, 'Notifications', 'Mark notification as read returns 200 OK');
    assert(markReadRes.data.data.isRead === true, 'Notifications', 'Notification isRead is true');
    assert(markReadRes.data.data.deliveryStatus === 'READ', 'Notifications', 'Delivery status transitioned to READ');

    // 26. Mark All Notifications as Read
    const markAllRes = await operatorClient.patch('/notifications/read-all');
    assert(markAllRes.status === 200, 'Notifications', 'Mark all notifications as read returns 200 OK');
    const remainingUnread = await Notification.countDocuments({
      tenantId: tenant._id,
      recipientId: operatorUser._id,
      isRead: false,
    });
    assert(remainingUnread === 0, 'Notifications', 'All operator notifications marked as read');

    // Cleanup test data
    console.log('\nCleaning up test artifacts from database...');
    await Job.deleteMany({ tenantId: tenant._id });
    await Customer.deleteMany({ tenantId: tenant._id });
    await Notification.deleteMany({ tenantId: tenant._id });
    await User.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    console.log('Cleanup complete.');

  } catch (err: any) {
    console.error('Test run failed with error:', err.response?.data || err.message);
  } finally {
    await db.disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log('                  TEST SUMMARY RESULTS                ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Executed : ${results.length}`);
  console.log(`Passed               : ${passedCount}`);
  console.log(`Failed               : ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFailed Tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - [${r.suite}] ${r.test}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PHASE 20 AUTOMATION AND WORKFLOW TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runPhase20Tests();
