export const logger = {
  info: (msg: string, ...args: any[]): void => {
    console.log(`[INFO] [${new Date().toISOString()}] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: any[]): void => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`, ...args);
  },
  error: (msg: string, ...args: any[]): void => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: any[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] [${new Date().toISOString()}] ${msg}`, ...args);
    }
  },
};

