import SaleWindow, { ISaleWindow } from '@/models/SaleWindow';
import { sendEmail } from '@/lib/email';

export const SALE_WINDOW_TEST_EMAILS = ['arslan@hestonautomotive.com', 'alex@hestonautomotive.com'];

const DAY = 24 * 60 * 60 * 1000;
const ANNUAL_RATE = 0.079;
const DAY_COUNT = 365;

export const SALE_WINDOW_SEED = [
  { invoiceNumber: 'NFANLGB26002173', vin: 'LS6CMG1G8TC910061', invoiceDate: '2026-08-27', financingDate: '2026-08-28', vehicleType: 'Stock' as const, initialAmount: 37713.89, outstandingAmount: 37713.89 },
  { invoiceNumber: 'NFANLGB26002172', vin: 'LS6C3E0M3TF607461', invoiceDate: '2026-08-27', financingDate: '2026-08-28', vehicleType: 'Stock' as const, initialAmount: 36793.87, outstandingAmount: 36793.87 },
  { invoiceNumber: 'NFANLGB26002170', vin: 'LS6C3E0MXTF606842', invoiceDate: '2026-08-27', financingDate: '2026-08-28', vehicleType: 'Stock' as const, initialAmount: 36793.87, outstandingAmount: 36793.87 },
  { invoiceNumber: 'NFANLGB26002174', vin: 'LS6CME0P0TC910674', invoiceDate: '2026-08-27', financingDate: '2026-08-28', vehicleType: 'Stock' as const, initialAmount: 35873.88, outstandingAmount: 35873.88 },
  { invoiceNumber: 'NFANLGB26002171', vin: 'LS6C3E0M0TF604551', invoiceDate: '2026-08-27', financingDate: '2026-08-28', vehicleType: 'Stock' as const, initialAmount: 36793.87, outstandingAmount: 36793.87 },
  { invoiceNumber: 'NFANLGB26002245', vin: 'LS6CME0P9TC910706', invoiceDate: '2026-09-02', financingDate: '2026-09-04', vehicleType: 'Demo' as const, initialAmount: 35873.88, outstandingAmount: 35873.88 },
  { invoiceNumber: 'NFANLGB26002243', vin: 'LS6C3E0M0TF605442', invoiceDate: '2026-09-02', financingDate: '2026-09-04', vehicleType: 'Demo' as const, initialAmount: 36793.87, outstandingAmount: 36793.87 },
  { invoiceNumber: 'NFANLGB26002246', vin: 'LS6CMG1G0TC910491', invoiceDate: '2026-09-02', financingDate: '2026-09-04', vehicleType: 'Demo' as const, initialAmount: 37713.89, outstandingAmount: 37713.89 },
];

export function utcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY);
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

export function formatUkDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export type SaleWindowView = {
  id: string;
  invoiceNumber: string;
  vin: string;
  vehicleType: 'Stock' | 'Demo';
  invoiceDate: string;
  financingDate: string;
  dayNumber: number;
  status: 'Interest-free' | 'Interest-bearing' | 'Payment due';
  day90: string;
  day360: string;
  daysTo90: number;
  daysTo360: number;
  initialAmount: number;
  outstandingAmount: number;
  interestToDate: number;
  closingBalance: number;
  soldAt: string | null;
};

export function toView(record: ISaleWindow, today = utcToday()): SaleWindowView {
  const invoiceDate = new Date(record.invoiceDate);
  const financingDate = new Date(record.financingDate || record.invoiceDate);
  const day90 = addDays(financingDate, 90);
  const day360 = addDays(financingDate, 360);
  const dayNumber = Math.max(0, daysBetween(financingDate, today));
  const interestDays = Math.max(0, Math.min(dayNumber, 359) - 89);
  const interestToDate = record.outstandingAmount * ANNUAL_RATE / DAY_COUNT * interestDays;
  const status = dayNumber < 90 ? 'Interest-free' : dayNumber < 360 ? 'Interest-bearing' : 'Payment due';
  return {
    id: String(record._id),
    invoiceNumber: record.invoiceNumber,
    vin: record.vin,
    vehicleType: record.vehicleType === 'Demo' ? 'Demo' : 'Stock',
    invoiceDate: invoiceDate.toISOString(),
    financingDate: financingDate.toISOString(),
    dayNumber,
    status,
    day90: day90.toISOString(),
    day360: day360.toISOString(),
    daysTo90: daysBetween(today, day90),
    daysTo360: daysBetween(today, day360),
    initialAmount: record.initialAmount,
    outstandingAmount: record.outstandingAmount,
    interestToDate,
    closingBalance: record.outstandingAmount + interestToDate,
    soldAt: record.soldAt ? new Date(record.soldAt).toISOString() : null,
  };
}

export async function ensureSaleWindows() {
  await SaleWindow.collection.updateMany({ vehicleType: 'New' }, { $set: { vehicleType: 'Stock' } });
  for (const row of SALE_WINDOW_SEED) {
    await SaleWindow.updateOne(
      { vin: row.vin },
      {
        $set: {
          invoiceNumber: row.invoiceNumber,
          invoiceDate: new Date(row.invoiceDate),
          financingDate: new Date(row.financingDate),
          initialAmount: row.initialAmount,
          outstandingAmount: row.outstandingAmount,
        },
        $setOnInsert: {
          vin: row.vin,
          vehicleType: row.vehicleType,
          soldAt: null,
        },
      },
      { upsert: true }
    );
  }
}

function dayLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} days over`;
  if (days === 0) return 'Due today';
  return `${days} days left`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendSaleWindowReminder() {
  const today = utcToday();
  await ensureSaleWindows();
  const records = await SaleWindow.find().sort({ invoiceDate: 1 });
  const rows = records.map((record) => toView(record, today)).sort((a, b) => {
    const soldRank = Number(Boolean(a.soldAt)) - Number(Boolean(b.soldAt));
    if (soldRank !== 0) return soldRank;
    return a.daysTo90 - b.daysTo90;
  });
  const recipients = SALE_WINDOW_TEST_EMAILS;
  const unsold = rows.filter((row) => !row.soldAt);
  const sold = rows.filter((row) => row.soldAt);
  const past90 = unsold.filter((row) => row.daysTo90 < 0).length;
  const dueSoon = unsold.filter((row) => row.daysTo90 >= 0 && row.daysTo90 <= 14).length;
  const cell = 'padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;';
  const body = rows
    .map((row) => {
      const stock = row.vehicleType !== 'Demo';
      const muted = row.soldAt ? 'color:#6b7280;background:#f9fafb;' : '';
      return `<tr style="${muted}">
        <td style="${cell}">${escapeHtml(row.vin)}<br><span style="color:#6b7280;font-size:12px;">${escapeHtml(row.invoiceNumber)}</span></td>
        <td style="${cell}"><span style="display:inline-block;padding:3px 8px;border-radius:6px;background:${stock ? '#16a34a' : '#dc2626'};color:#ffffff;font-weight:700;">${stock ? 'Stock' : 'Demo'}</span>${row.soldAt ? '<br><span style="display:inline-block;margin-top:6px;padding:3px 8px;border-radius:6px;background:#374151;color:#ffffff;font-weight:700;">Sold</span>' : ''}</td>
        <td style="${cell}">${row.dayNumber}</td>
        <td style="${cell}">${escapeHtml(row.status)}</td>
        <td style="${cell}">${dayLabel(row.daysTo90)}<br><span style="color:#6b7280;font-size:12px;">${formatUkDate(new Date(row.day90))}</span></td>
        <td style="${cell}">${dayLabel(row.daysTo360)}<br><span style="color:#6b7280;font-size:12px;">${formatUkDate(new Date(row.day360))}</span></td>
        <td style="${cell}">${formatMoney(row.outstandingAmount)}</td>
        <td style="${cell}">${formatMoney(row.interestToDate)}</td>
        <td style="${cell}">${formatMoney(row.closingBalance)}</td>
      </tr>`;
    })
    .join('');

  const appUrl = process.env.FRONTEND_URL || 'https://video.hestonautomotive.com';
  await sendEmail({
    to: recipients,
    subject: `Days to sell test: ${unsold.length} unsold, ${sold.length} sold`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f2937;">
        <h2 style="margin:0 0 8px;">Days to sell</h2>
        <p style="margin:0 0 16px;">Test email. ${unsold.length} vehicles are still unsold and ${sold.length} are marked sold. ${past90} unsold are past the 90-day mark and ${dueSoon} reach it within 14 days. Stock is green, Demo is red.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;text-align:left;">
              <th style="padding:8px 10px;">Vehicle</th>
              <th style="padding:8px 10px;">Status</th>
              <th style="padding:8px 10px;">Day</th>
              <th style="padding:8px 10px;">Stage</th>
              <th style="padding:8px 10px;">90 days</th>
              <th style="padding:8px 10px;">360 days</th>
              <th style="padding:8px 10px;">Balance</th>
              <th style="padding:8px 10px;">Interest</th>
              <th style="padding:8px 10px;">Closing</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
        <p style="margin:16px 0 0;"><a href="${appUrl}/staff/days-to-sell">Open the dashboard</a></p>
      </div>
    `,
  });

  return { sent: true, recipients, count: rows.length, unsold: unsold.length, sold: sold.length };
}
