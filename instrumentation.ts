export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = (await import('node-cron')).default;
    const { fetchAllStockFromAutoTrader } = await import('./lib/autotrader');

    // 6am, 12pm, 6pm daily
    cron.schedule('0 6,12,18 * * *', async () => {
      console.log('[AutoTrader Sync] Starting scheduled sync...');
      const result = await fetchAllStockFromAutoTrader();
      console.log('[AutoTrader Sync] Done:', result);
    });

    console.log('[AutoTrader Sync] Cron scheduled — 6am, 12pm, 6pm daily');
  }
}
