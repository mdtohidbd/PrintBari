import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { performance } from 'perf_hooks';
import { db } from '../config/db';
import { Tenant } from '../models/Tenant.model';
import { User } from '../models/User.model';
import { Customer } from '../models/Customer.model';
import { Job } from '../models/Job.model';
import { backgroundWorker } from '../services/backgroundWorker';
import { TokenService } from '../utils/token';

const API_BASE = 'http://localhost:5000/api/v1';

interface LatencySummary {
  operation: string;
  totalRequests: number;
  successful: number;
  failed: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  rps: number;
}

function calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number; mean: number } {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0, mean: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const mean = Math.round(sorted.reduce((acc, v) => acc + v, 0) / sorted.length);
  const p50 = Math.round(sorted[Math.floor(sorted.length * 0.5)]);
  const p95 = Math.round(sorted[Math.floor(sorted.length * 0.95)]);
  const p99 = Math.round(sorted[Math.floor(sorted.length * 0.99)]);
  return { p50, p95, p99, mean };
}

async function runPerformanceAndScalabilityTests() {
  console.log('\n======================================================');
  console.log('   PHASE 22: PERFORMANCE & SCALABILITY LOAD TESTING   ');
  console.log('======================================================\n');

  await db.connect();
  console.log('Connected to MongoDB Atlas for benchmarking...\n');

  const summaries: LatencySummary[] = [];

  try {
    const timestamp = Date.now();
    const NUM_SHOPS = 3;
    const testTenants: any[] = [];
    const testUsers: any[] = [];
    const testClients: AxiosInstance[] = [];

    console.log(`[Setup] Provisioning ${NUM_SHOPS} multi-tenant shops and user accounts...`);

    for (let i = 0; i < NUM_SHOPS; i++) {
      const businessId = `SHOP-PERF-${timestamp}-${i}`;
      const subdomain = `perf-${timestamp.toString().slice(-4)}-${i}`;

      const t = await Tenant.create({
        businessId,
        subdomain,
        name: `Benchmarking Studio ${i + 1}`,
        ownerEmail: `owner_perf_${timestamp}_${i}@test.com`,
        subscription: {
          plan: 'BUSINESS',
          status: 'ACTIVE',
          trialEndsAt: new Date(Date.now() + 30 * 86400000),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        },
        quotas: {
          maxStaffSeats: 10,
          monthlyJobsLimit: 5000,
          monthlyJobsUsed: 0,
          monthlyPassportLayoutsLimit: 10000,
          monthlyPassportLayoutsUsed: 0,
          monthlyOcrPagesLimit: 1000,
          monthlyOcrPagesUsed: 0,
          storageLimitBytes: 100 * 1024 * 1024 * 1024,
          storageUsedBytes: 0,
        },
        isActive: true,
      });

      const u = await User.create({
        tenantId: t._id,
        fullName: `Operator Shop ${i + 1}`,
        email: `operator_${timestamp}_${i}@test.com`,
        passwordHash: 'hashed_pw_test',
        role: 'OPERATOR',
        phone: `017${i}${timestamp.toString().slice(-7)}`,
        isActive: true,
      });

      const token = TokenService.generateAccessToken({
        userId: u._id.toString(),
        tenantId: t._id.toString(),
        role: u.role,
        email: u.email,
      });

      const client = axios.create({
        baseURL: API_BASE,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': t._id.toString(),
        },
      });

      testTenants.push(t);
      testUsers.push(u);
      testClients.push(client);
    }
    console.log(`[Setup] ${NUM_SHOPS} shops provisioned successfully.\n`);

    // -------------------------------------------------------------
    // BENCHMARK 1: High-Volume Concurrent Database Queries
    // -------------------------------------------------------------
    console.log('--- BENCHMARK 1: High-Volume Multi-Tenant Queries (100 parallel requests) ---');
    const TOTAL_QUERY_REQS = 100;
    const queryLatencies: number[] = [];
    let querySuccess = 0;
    let queryFail = 0;

    const b1Start = performance.now();
    const queryPromises = Array.from({ length: TOTAL_QUERY_REQS }).map(async (_, idx) => {
      const client = testClients[idx % NUM_SHOPS];
      const start = performance.now();
      try {
        const res = await client.get('/jobs?limit=10&page=1');
        const duration = performance.now() - start;
        queryLatencies.push(duration);
        if (res.status === 200) querySuccess++;
        else queryFail++;
      } catch (err) {
        queryFail++;
      }
    });

    await Promise.all(queryPromises);
    const b1TotalTime = (performance.now() - b1Start) / 1000;
    const qPct = calculatePercentiles(queryLatencies);

    summaries.push({
      operation: 'Multi-Tenant Job Listing Queries',
      totalRequests: TOTAL_QUERY_REQS,
      successful: querySuccess,
      failed: queryFail,
      minMs: Math.round(Math.min(...queryLatencies)),
      maxMs: Math.round(Math.max(...queryLatencies)),
      meanMs: qPct.mean,
      p50Ms: qPct.p50,
      p95Ms: qPct.p95,
      p99Ms: qPct.p99,
      rps: Math.round(TOTAL_QUERY_REQS / b1TotalTime),
    });

    console.log(`  ✓ Completed ${TOTAL_QUERY_REQS} queries in ${b1TotalTime.toFixed(2)}s (${Math.round(TOTAL_QUERY_REQS / b1TotalTime)} req/s)`);
    console.log(`  ✓ Latency: Mean=${qPct.mean}ms | p50=${qPct.p50}ms | p95=${qPct.p95}ms | p99=${qPct.p99}ms | Errors=${queryFail}`);

    // -------------------------------------------------------------
    // BENCHMARK 2: Fast Customer Counter Search (Compound Index Speed)
    // -------------------------------------------------------------
    console.log('\n--- BENCHMARK 2: Fast Customer Counter Search (Indexed Mobile Lookup) ---');
    // Pre-populate 50 customers
    const createdCustomers: any[] = [];
    for (let i = 0; i < 50; i++) {
      const tenant = testTenants[i % NUM_SHOPS];
      const cust = await Customer.create({
        tenantId: tenant._id,
        fullName: `Customer Name ${i}`,
        phone: `01800${i.toString().padStart(4, '0')}`,
        email: `cust${i}@test.com`,
        totalOrdersCount: 2,
        totalSpent: 400,
        isActive: true,
      });
      createdCustomers.push(cust);
    }

    const LOOKUP_REQS = 60;
    const lookupLatencies: number[] = [];
    let lookupSuccess = 0;
    let lookupFail = 0;

    const b2Start = performance.now();
    const lookupPromises = Array.from({ length: LOOKUP_REQS }).map(async (_, idx) => {
      const targetCust = createdCustomers[idx % createdCustomers.length];
      const client = testClients.find((c, i) => testTenants[i]._id.toString() === targetCust.tenantId.toString())!;
      const start = performance.now();
      try {
        const res = await client.get(`/customers/lookup?phone=${targetCust.phone}`);
        const duration = performance.now() - start;
        lookupLatencies.push(duration);
        if (res.status === 200 && res.data.data.found) lookupSuccess++;
        else lookupFail++;
      } catch (err) {
        lookupFail++;
      }
    });

    await Promise.all(lookupPromises);
    const b2TotalTime = (performance.now() - b2Start) / 1000;
    const lPct = calculatePercentiles(lookupLatencies);

    summaries.push({
      operation: 'Fast Customer Mobile Lookup (Indexed)',
      totalRequests: LOOKUP_REQS,
      successful: lookupSuccess,
      failed: lookupFail,
      minMs: Math.round(Math.min(...lookupLatencies)),
      maxMs: Math.round(Math.max(...lookupLatencies)),
      meanMs: lPct.mean,
      p50Ms: lPct.p50,
      p95Ms: lPct.p95,
      p99Ms: lPct.p99,
      rps: Math.round(LOOKUP_REQS / b2TotalTime),
    });

    console.log(`  ✓ Completed ${LOOKUP_REQS} lookups in ${b2TotalTime.toFixed(2)}s (${Math.round(LOOKUP_REQS / b2TotalTime)} req/s)`);
    console.log(`  ✓ Latency: Mean=${lPct.mean}ms | p50=${lPct.p50}ms | p95=${lPct.p95}ms | p99=${lPct.p99}ms | Errors=${lookupFail}`);

    // -------------------------------------------------------------
    // BENCHMARK 3: Concurrent Job Creation & Status Transitions
    // -------------------------------------------------------------
    console.log('\n--- BENCHMARK 3: Concurrent Job Order Submissions & Quota Updates ---');
    const JOB_REQS = 40;
    const jobLatencies: number[] = [];
    let jobSuccess = 0;
    let jobFail = 0;

    const b3Start = performance.now();
    const jobPromises = Array.from({ length: JOB_REQS }).map(async (_, idx) => {
      const client = testClients[idx % NUM_SHOPS];
      const cust = createdCustomers[idx % createdCustomers.length];
      const start = performance.now();
      try {
        const res = await client.post('/jobs', {
          customerId: cust._id,
          customerName: cust.fullName,
          customerPhone: cust.phone,
          serviceType: 'PASSPORT_PHOTO',
          copies: 4,
          price: { subtotal: 100, discount: 0, tax: 0, totalPrice: 100 },
          paidAmount: 100,
        });
        const duration = performance.now() - start;
        jobLatencies.push(duration);
        if (res.status === 201) jobSuccess++;
        else jobFail++;
      } catch (err) {
        jobFail++;
      }
    });

    await Promise.all(jobPromises);
    const b3TotalTime = (performance.now() - b3Start) / 1000;
    const jPct = calculatePercentiles(jobLatencies);

    summaries.push({
      operation: 'Job Order Creation & Audit Writing',
      totalRequests: JOB_REQS,
      successful: jobSuccess,
      failed: jobFail,
      minMs: Math.round(Math.min(...jobLatencies)),
      maxMs: Math.round(Math.max(...jobLatencies)),
      meanMs: jPct.mean,
      p50Ms: jPct.p50,
      p95Ms: jPct.p95,
      p99Ms: jPct.p99,
      rps: Math.round(JOB_REQS / b3TotalTime),
    });

    console.log(`  ✓ Completed ${JOB_REQS} job orders in ${b3TotalTime.toFixed(2)}s (${Math.round(JOB_REQS / b3TotalTime)} req/s)`);
    console.log(`  ✓ Latency: Mean=${jPct.mean}ms | p50=${jPct.p50}ms | p95=${jPct.p95}ms | p99=${jPct.p99}ms | Errors=${jobFail}`);

    // -------------------------------------------------------------
    // BENCHMARK 4: Image Processing & Concurrency Limiting
    // -------------------------------------------------------------
    console.log('\n--- BENCHMARK 4: Image Processing Under Concurrency Gating (10 concurrent Sharp tasks) ---');
    const testImageBuffer = await sharp({
      create: {
        width: 1200,
        height: 1600,
        channels: 3,
        background: { r: 235, g: 240, b: 245 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const IMAGE_TASKS = 10;
    const imgLatencies: number[] = [];
    let imgSuccess = 0;
    let imgFail = 0;

    const b4Start = performance.now();
    const imgPromises = Array.from({ length: IMAGE_TASKS }).map(async (_, idx) => {
      const taskStart = performance.now();
      const taskHash = `hash_bench_${timestamp}_${idx}`;
      try {
        const task = await backgroundWorker.executeTask(
          testTenants[idx % NUM_SHOPS]._id.toString(),
          'PASSPORT',
          taskHash,
          async (progress) => {
            progress(25);
            // Simulated 300 DPI transform & crop
            const processed = await sharp(testImageBuffer)
              .resize(413, 531, { fit: 'cover' })
              .sharpen()
              .jpeg({ quality: 95 })
              .toBuffer();
            progress(100);
            return {
              result: { size: processed.length, format: 'jpeg' },
              metadata: { inputBytes: testImageBuffer.length, outputBytes: processed.length },
            };
          }
        );
        const duration = performance.now() - taskStart;
        imgLatencies.push(duration);
        if (task.status === 'COMPLETED') imgSuccess++;
        else imgFail++;
      } catch (err) {
        imgFail++;
      }
    });

    await Promise.all(imgPromises);
    const b4TotalTime = (performance.now() - b4Start) / 1000;
    const iPct = calculatePercentiles(imgLatencies);
    const workerMetrics = backgroundWorker.getMetrics();

    summaries.push({
      operation: 'High-Res Image Pipeline (Sharp Concurrency Gated)',
      totalRequests: IMAGE_TASKS,
      successful: imgSuccess,
      failed: imgFail,
      minMs: Math.round(Math.min(...imgLatencies)),
      maxMs: Math.round(Math.max(...imgLatencies)),
      meanMs: iPct.mean,
      p50Ms: iPct.p50,
      p95Ms: iPct.p95,
      p99Ms: iPct.p99,
      rps: Math.round(IMAGE_TASKS / b4TotalTime),
    });

    console.log(`  ✓ Completed ${IMAGE_TASKS} image pipelines in ${b4TotalTime.toFixed(2)}s`);
    console.log(`  ✓ Latency: Mean=${iPct.mean}ms | p50=${iPct.p50}ms | p95=${iPct.p95}ms | p99=${iPct.p99}ms | Errors=${imgFail}`);
    console.log(`  ✓ Concurrency Gating Metrics: activeWorkers=${workerMetrics.activeWorkers}, totalCompleted=${workerMetrics.totalCompleted}, maxConcurrent=${workerMetrics.maxConcurrent}`);

    // Cleanup test artifacts
    console.log('\nCleaning up benchmark data from database...');
    for (const t of testTenants) {
      await Job.deleteMany({ tenantId: t._id });
      await Customer.deleteMany({ tenantId: t._id });
      await User.deleteMany({ tenantId: t._id });
      await Tenant.deleteOne({ _id: t._id });
    }
    console.log('Cleanup complete.');

  } catch (err: any) {
    console.error('Benchmark error:', err.response?.data || err.message);
  } finally {
    await db.disconnect();
  }

  // Final Summary Table Output
  console.log('\n========================================================================================');
  console.log('                         BENCHMARK LATENCY & THROUGHPUT REPORT                          ');
  console.log('========================================================================================');
  console.log(
    'Operation'.padEnd(42) +
      'Reqs'.padEnd(8) +
      'p50'.padEnd(8) +
      'p95'.padEnd(8) +
      'p99'.padEnd(8) +
      'Mean'.padEnd(8) +
      'RPS'.padEnd(8) +
      'Errors'
  );
  console.log('-'.repeat(96));

  for (const s of summaries) {
    console.log(
      s.operation.padEnd(42) +
        s.totalRequests.toString().padEnd(8) +
        `${s.p50Ms}ms`.padEnd(8) +
        `${s.p95Ms}ms`.padEnd(8) +
        `${s.p99Ms}ms`.padEnd(8) +
        `${s.meanMs}ms`.padEnd(8) +
        s.rps.toString().padEnd(8) +
        s.failed.toString()
    );
  }
  console.log('========================================================================================\n');
}

runPerformanceAndScalabilityTests();

