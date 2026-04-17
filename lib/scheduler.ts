import cron from 'node-cron';
import { fetchAllStockFromAutoTrader } from './autotrader';

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const runSync = async () => {
    console.log(`[${new Date().toISOString()}] Starting scheduled AutoTrader sync...`);
    try {
      const result = await fetchAllStockFromAutoTrader();
      if (result && !result.success && result.message === 'Sync already in progress') {
        console.log(`[${new Date().toISOString()}] Scheduled AutoTrader sync skipped (already running).`);
      } else {
        console.log(`[${new Date().toISOString()}] Scheduled AutoTrader sync completed. Processed: ${(result as any)?.totalVehicles ?? 0} items.`);
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Scheduled AutoTrader sync failed:`, error.message);
    }
  };

  // Run at 6:00, 12:00, and 18:00 every day
  cron.schedule('0 6,12,18 * * *', runSync);

  console.log('AutoTrader Sync Scheduler started: Running at 6am, 12pm, 6pm daily.');
}
