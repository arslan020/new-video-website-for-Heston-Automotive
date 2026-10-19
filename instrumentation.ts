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
      const { isLondonMondaySendWindow, sendMondayEmailOnce } = await import('./lib/saleWindow');
      cron.schedule('* * * * *', async () => {
        if (!isLondonMondaySendWindow()) return;
        console.log('[Days to Sell] Sending Monday 9am email...');
        await connectDB();
        const result = await sendMondayEmailOnce();
        console.log('[Days to Sell] Monday email:', result);
      }, { timezone: 'Europe/London' });
      console.log('[Days to Sell] Cron scheduled — Monday 9:00 UK time, retries until 9:20');
    }
  }
}
