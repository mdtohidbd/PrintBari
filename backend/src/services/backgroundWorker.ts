import { EventEmitter } from 'events';
import { logger } from '../config/logger';

export type TaskType = 'PASSPORT' | 'DOCUMENT' | 'IDCARD' | 'CV' | 'OCR';
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IProcessingTask<T = any> {
  taskId: string;
  tenantId: string;
  taskType: TaskType;
  status: TaskStatus;
  progress: number; // 0 - 100
  inputHash: string;
  metadata?: {
    inputBytes?: number;
    outputBytes?: number;
    dimensions?: { width: number; height: number };
    dpi?: number;
    executionTimeMs?: number;
  };
  result?: T;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BackgroundProcessingWorker extends EventEmitter {
  private static instance: BackgroundProcessingWorker;
  private tasks: Map<string, IProcessingTask> = new Map();
  private hashToTaskId: Map<string, string> = new Map();
  private maxConcurrent: number = 4;
  private activeWorkers: number = 0;
  private waitingQueue: Array<() => void> = [];
  private totalCompleted: number = 0;

  private constructor() {
    super();
    // Periodic garbage collection: prune completed or failed tasks older than 1 hour
    setInterval(() => this.cleanupOldTasks(), 15 * 60 * 1000);
  }

  public static getInstance(): BackgroundProcessingWorker {
    if (!BackgroundProcessingWorker.instance) {
      BackgroundProcessingWorker.instance = new BackgroundProcessingWorker();
    }
    return BackgroundProcessingWorker.instance;
  }

  /**
   * Register a new background processing task or return existing if duplicate
   */
  public createTask(params: {
    tenantId: string;
    taskType: TaskType;
    inputHash: string;
    maxRetries?: number;
  }): { task: IProcessingTask; isDuplicate: boolean } {
    // Duplicate check
    const existingTaskId = this.hashToTaskId.get(params.inputHash);
    if (existingTaskId) {
      const existing = this.tasks.get(existingTaskId);
      if (existing && (existing.status === 'COMPLETED' || existing.status === 'PROCESSING')) {
        logger.info(`[Worker] Duplicate processing prevented for hash: ${params.inputHash.slice(0, 12)}`);
        return { task: existing, isDuplicate: true };
      }
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const task: IProcessingTask = {
      taskId,
      tenantId: params.tenantId,
      taskType: params.taskType,
      status: 'PENDING',
      progress: 0,
      inputHash: params.inputHash,
      retryCount: 0,
      maxRetries: params.maxRetries || 3,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, task);
    this.hashToTaskId.set(params.inputHash, taskId);
    this.emit('task:created', task);

    return { task, isDuplicate: false };
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): IProcessingTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Update task progress
   */
  public updateProgress(taskId: string, progress: number, status: TaskStatus = 'PROCESSING'): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.min(100, Math.max(0, progress));
    task.status = status;
    task.updatedAt = new Date();
    this.emit('task:progress', { taskId, progress, status });
  }

  /**
   * Mark task as completed with result data and execution metadata
   */
  public completeTask<T>(
    taskId: string,
    result: T,
    metadata?: IProcessingTask['metadata']
  ): IProcessingTask<T> | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = 'COMPLETED';
    task.progress = 100;
    task.result = result;
    if (metadata) {
      task.metadata = { ...task.metadata, ...metadata };
    }
    task.updatedAt = new Date();
    this.totalCompleted++;
    this.emit('task:completed', task);
    logger.info(`[Worker] Task ${taskId} (${task.taskType}) completed in ${metadata?.executionTimeMs || 0}ms`);
    return task;
  }

  /**
   * Mark task as failed or schedule safe retry
   */
  public failTask(taskId: string, error: Error | string): IProcessingTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const errMsg = typeof error === 'string' ? error : error.message;

    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = 'PENDING';
      task.progress = 0;
      task.error = `Attempt ${task.retryCount} failed: ${errMsg}. Retrying...`;
      task.updatedAt = new Date();
      logger.warn(`[Worker] Task ${taskId} retry ${task.retryCount}/${task.maxRetries}: ${errMsg}`);
      this.emit('task:retry', task);
      return task;
    }

    task.status = 'FAILED';
    task.error = errMsg;
    task.updatedAt = new Date();
    logger.error(`[Worker] Task ${taskId} (${task.taskType}) permanently failed: ${errMsg}`);
    this.emit('task:failed', task);
    return task;
  }

  /**
   * Acquire a processing slot, queuing if max concurrency reached
   */
  private async acquireSlot(): Promise<void> {
    if (this.activeWorkers < this.maxConcurrent) {
      this.activeWorkers++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
    });
    this.activeWorkers++;
  }

  /**
   * Release a processing slot and awaken next waiting task
   */
  private releaseSlot(): void {
    this.activeWorkers = Math.max(0, this.activeWorkers - 1);
    const next = this.waitingQueue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Get real-time worker metrics
   */
  public getMetrics(): {
    activeWorkers: number;
    queuedTasks: number;
    maxConcurrent: number;
    totalTasksTracked: number;
    totalCompleted: number;
  } {
    return {
      activeWorkers: this.activeWorkers,
      queuedTasks: this.waitingQueue.length,
      maxConcurrent: this.maxConcurrent,
      totalTasksTracked: this.tasks.size,
      totalCompleted: this.totalCompleted,
    };
  }

  /**
   * Execute an async processor function safely inside the worker wrapper with concurrency gating
   */
  public async executeTask<T>(
    tenantId: string,
    taskType: TaskType,
    inputHash: string,
    processor: (updateProgress: (p: number) => void) => Promise<{ result: T; metadata?: IProcessingTask['metadata'] }>
  ): Promise<IProcessingTask<T>> {
    const { task, isDuplicate } = this.createTask({ tenantId, taskType, inputHash });
    if (isDuplicate && task.status === 'COMPLETED') {
      return task;
    }

    await this.acquireSlot();
    const startTime = Date.now();
    this.updateProgress(task.taskId, 10, 'PROCESSING');

    try {
      const { result, metadata } = await processor((p) => this.updateProgress(task.taskId, p, 'PROCESSING'));
      const executionTimeMs = Date.now() - startTime;
      const completed = this.completeTask(task.taskId, result, {
        ...metadata,
        executionTimeMs,
      });
      return completed!;
    } catch (err: any) {
      this.failTask(task.taskId, err);
      throw err;
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Prune stale tasks older than 1 hour to prevent memory leaks
   */
  public cleanupOldTasks(maxAgeMs: number = 60 * 60 * 1000): void {
    const threshold = Date.now() - maxAgeMs;
    let prunedCount = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if ((task.status === 'COMPLETED' || task.status === 'FAILED') && task.updatedAt.getTime() < threshold) {
        this.tasks.delete(taskId);
        this.hashToTaskId.delete(task.inputHash);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      logger.debug(`[Worker] Pruned ${prunedCount} stale background processing tasks`);
    }
  }

  public getCapacity() {
    return {
      maxConcurrent: this.maxConcurrent,
      activeWorkers: this.activeWorkers,
      queuedJobs: this.waitingQueue.length,
      totalCompleted: this.totalCompleted,
    };
  }
}

export const backgroundWorker = BackgroundProcessingWorker.getInstance();

