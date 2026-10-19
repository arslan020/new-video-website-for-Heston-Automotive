import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import SaleWindow from '@/models/SaleWindow';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { toView, utcToday } from '@/lib/saleWindow';

function utcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ message: 'Vehicle not found' }, { status: 404 });
    }

    const body = await req.json();
    const hasSold = typeof body.sold === 'boolean';
    const hasType = body.vehicleType === 'Stock' || body.vehicleType === 'Demo' || body.vehicleType === 'New';
    const hasInvoice = body.invoiceNumber !== undefined;
    const hasVin = body.vin !== undefined;
    const hasInvoiceDate = body.invoiceDate !== undefined;
    const hasFinancingDate = body.financingDate !== undefined;
    const hasAmount = body.outstandingAmount !== undefined;
    if (!hasSold && !hasType && !hasInvoice && !hasVin && !hasInvoiceDate && !hasFinancingDate && !hasAmount) {
      return Response.json({ message: 'Nothing to update' }, { status: 400 });
    }

    const update: {
      vehicleType?: 'Stock' | 'Demo';
      soldAt?: Date | null;
      invoiceNumber?: string;
      vin?: string;
      invoiceDate?: Date;
      financingDate?: Date;
      outstandingAmount?: number;
      initialAmount?: number;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (hasType) update.vehicleType = body.vehicleType === 'Demo' ? 'Demo' : 'Stock';
    if (hasSold) update.soldAt = body.sold ? new Date() : null;
    if (hasInvoice) {
      const invoiceNumber = String(body.invoiceNumber || '').trim();
      if (!invoiceNumber) return Response.json({ message: 'Invoice number is required' }, { status: 400 });
      update.invoiceNumber = invoiceNumber;
    }
    if (hasVin) {
      const vin = String(body.vin || '').trim().toUpperCase();
      if (!vin) return Response.json({ message: 'VIN is required' }, { status: 400 });
      update.vin = vin;
    }
    if (hasInvoiceDate) {
      const invoiceDate = utcDate(String(body.invoiceDate || ''));
      if (!invoiceDate) return Response.json({ message: 'Invoice date is required' }, { status: 400 });
      update.invoiceDate = invoiceDate;
    }
    if (hasFinancingDate) {
      const financingDate = utcDate(String(body.financingDate || ''));
      if (!financingDate) return Response.json({ message: 'Financing date is required' }, { status: 400 });
      update.financingDate = financingDate;
    }
    if (hasAmount) {
      const amount = Number(body.outstandingAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return Response.json({ message: 'Outstanding amount is required' }, { status: 400 });
      }
      update.outstandingAmount = amount;
      update.initialAmount = amount;
    }

    await connectDB();
    if (update.vin || update.invoiceNumber) {
      const clash = await SaleWindow.findOne({
        _id: { $ne: id },
        $or: [
          ...(update.vin ? [{ vin: update.vin }] : []),
          ...(update.invoiceNumber ? [{ invoiceNumber: update.invoiceNumber }] : []),
        ],
      });
      if (clash) {
        return Response.json({ message: 'This VIN or invoice is already on the list' }, { status: 409 });
      }
    }

    const result = await SaleWindow.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return Response.json({ message: 'Vehicle not found' }, { status: 404 });
    }

    const record = await SaleWindow.findById(id);
    if (!record) return Response.json({ message: 'Vehicle not found' }, { status: 404 });
    return Response.json(toView(record, utcToday()));
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update vehicle' }, { status: 500 });
  }
}
