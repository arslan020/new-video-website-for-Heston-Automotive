import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import SaleWindow from '@/models/SaleWindow';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { ensureSaleWindows, toView, utcToday } from '@/lib/saleWindow';

function utcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    await connectDB();
    await ensureSaleWindows();
    const today = utcToday();
    const records = await SaleWindow.find({}).sort({ invoiceDate: 1 });
    const vehicles = records
      .map((record) => toView(record, today))
      .sort((a, b) => Number(Boolean(a.soldAt)) - Number(Boolean(b.soldAt)) || a.daysTo90 - b.daysTo90);

    const active = vehicles.filter((vehicle) => !vehicle.soldAt);
    const soonest90 = active.reduce((min, vehicle) => Math.min(min, vehicle.daysTo90), Number.POSITIVE_INFINITY);
    const soonest360 = active.reduce((min, vehicle) => Math.min(min, vehicle.daysTo360), Number.POSITIVE_INFINITY);
    return Response.json({
      vehicles,
      summary: {
        active: active.length,
        outstanding: active.reduce((sum, vehicle) => sum + vehicle.outstandingAmount, 0),
        interest: active.reduce((sum, vehicle) => sum + vehicle.interestToDate, 0),
        soonest90: Number.isFinite(soonest90) ? soonest90 : 0,
        soonest360: Number.isFinite(soonest360) ? soonest360 : 0,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to load days to sell' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    const body = await req.json();
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    const vin = String(body.vin || '').trim().toUpperCase();
    const vehicleType = body.vehicleType === 'Demo' ? 'Demo' : body.vehicleType === 'New' ? 'New' : '';
    const invoiceDate = utcDate(String(body.invoiceDate || ''));
    const financingDate = utcDate(String(body.financingDate || ''));
    const amount = Number(body.outstandingAmount);

    if (!invoiceNumber || !vin || !vehicleType || !invoiceDate || !financingDate || !Number.isFinite(amount) || amount < 0) {
      return Response.json({ message: 'Fill in invoice, VIN, dates, type and amount' }, { status: 400 });
    }

    await connectDB();
    const existing = await SaleWindow.findOne({ $or: [{ vin }, { invoiceNumber }] });
    if (existing) {
      return Response.json({ message: 'This VIN or invoice is already on the list' }, { status: 409 });
    }

    const record = await SaleWindow.create({
      invoiceNumber,
      vin,
      invoiceDate,
      financingDate,
      vehicleType,
      initialAmount: amount,
      outstandingAmount: amount,
      soldAt: null,
    });

    return Response.json(toView(record, utcToday()), { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to add vehicle' }, { status: 500 });
  }
}
