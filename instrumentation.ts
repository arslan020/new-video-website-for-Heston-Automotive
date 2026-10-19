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

    if (!process.env.VERCEL) {
      const { connectDB } = await import('./lib/mongodb');
      const { SALE_WINDOW_MONDAY_EMAIL, sendSaleWindowReminder } = await import('./lib/saleWindow');
      cron.schedule('50 15 * * 1', async () => {
        console.log('[Days to Sell] Sending Monday email to Arslan...');
        await connectDB();
        const result = await sendSaleWindowReminder(SALE_WINDOW_MONDAY_EMAIL);
        console.log('[Days to Sell] Monday email sent:', result);
      }, { timezone: 'Europe/London' });
      console.log('[Days to Sell] Cron scheduled — Monday 15:50 UK time');
    }
  }
}
