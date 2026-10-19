'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';

type Vehicle = {
  id: string;
  invoiceNumber: string;
  vin: string;
  vehicleType: 'Stock' | 'Demo';
  invoiceDate: string;
  dayNumber: number;
  status: string;
  day90: string;
  day360: string;
  daysTo90: number;
  daysTo360: number;
  outstandingAmount: number;
  interestToDate: number;
  closingBalance: number;
  soldAt: string | null;
};

type Summary = {
  active: number;
  outstanding: number;
  interest: number;
  soonest90: number;
  soonest360: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function dayText(days: number) {
  if (days < 0) return `${Math.abs(days)} over`;
  if (days === 0) return 'Today';
  return `${days} left`;
}

function dayClass(days: number) {
  if (days < 0) return 'text-red-600';
  if (days <= 14) return 'text-amber-600';
  return 'text-gray-900';
}

export default function DaysToSellContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: '',
    vin: '',
    vehicleType: 'Stock' as 'Stock' | 'Demo',
    invoiceDate: '',
    financingDate: '',
    outstandingAmount: '',
  });

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/sale-window', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setVehicles(data.vehicles || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error(error);
      showToast('Could not load the days to sell list', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, user?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const updateType = async (vehicle: Vehicle, vehicleType: 'Stock' | 'Demo') => {
    if (!user?.token || vehicle.vehicleType === vehicleType) return;
    setSavingId(vehicle.id);
    try {
      const res = await fetch(`/api/sale-window/${vehicle.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vehicleType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      setVehicles((current) => current.map((item) => (item.id === vehicle.id ? data : item)));
    } catch (error) {
      console.error(error);
      showToast('Could not update the status', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const markSold = async (vehicle: Vehicle, sold: boolean) => {
    if (!user?.token) return;
    setSavingId(vehicle.id);
    try {
      const res = await fetch(`/api/sale-window/${vehicle.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      setVehicles((current) =>
        current
          .map((item) => (item.id === vehicle.id ? data : item))
          .sort((a, b) => Number(Boolean(a.soldAt)) - Number(Boolean(b.soldAt)) || a.daysTo90 - b.daysTo90)
      );
      setSummary((current) => {
        if (!current) return current;
        const nextActive = sold ? current.active - 1 : current.active + 1;
        return { ...current, active: nextActive };
      });
      showToast(sold ? 'Marked as sold' : 'Moved back to unsold', 'success');
      load();
    } catch (error) {
      console.error(error);
      showToast('Could not update this vehicle', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const sendTest = async () => {
    if (!user?.token) return;
    setSendingTest(true);
    try {
      const res = await fetch('/api/sale-window/test-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send');
      showToast('Test email sent to Arslan and Alex', 'success');
    } catch (error) {
      console.error(error);
      showToast('Could not send the test email', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const addVehicle = async () => {
    if (!user?.token) return;
    setAdding(true);
    try {
      const res = await fetch('/api/sale-window', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          outstandingAmount: Number(form.outstandingAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add');
      setForm({
        invoiceNumber: '',
        vin: '',
        vehicleType: 'Stock',
        invoiceDate: '',
        financingDate: '',
        outstandingAmount: '',
      });
      setShowForm(false);
      showToast('Vehicle added', 'success');
      load();
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : 'Could not add the vehicle', 'error');
    } finally {
      setAdding(false);
    }
  };

  const cards = [
    { label: 'Still to sell', value: String(summary?.active ?? 0), tone: 'text-gray-900' },
    { label: 'Total outstanding', value: formatMoney(summary?.outstanding ?? 0), tone: 'text-gray-900' },
    { label: 'Soonest 90-day mark', value: `${summary?.soonest90 ?? 0} days`, tone: 'text-amber-600' },
    { label: 'Soonest 360-day mark', value: `${summary?.soonest360 ?? 0} days`, tone: 'text-blue-700' },
    { label: 'Interest to date', value: formatMoney(summary?.interest ?? 0), tone: 'text-gray-900' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Days to Sell</h1>
          <p className="mt-1 text-sm text-gray-500">
            Counted from the financing date, the same way as the tracker. Interest stays at zero until day 90, then runs at 7.9% of the balance divided by 365.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Add vehicle
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={sendingTest}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sendingTest ? 'Sending...' : 'Send test email to Arslan and Alex'}
          </button>
        </div>
      </div>

      {showForm ? (
        <form
          className="mb-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            addVehicle();
          }}
        >
          <label className="text-sm text-gray-600">
            Invoice number
            <input
              required
              value={form.invoiceNumber}
              onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="text-sm text-gray-600">
            VIN
            <input
              required
              value={form.vin}
              onChange={(event) => setForm({ ...form, vin: event.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="text-sm text-gray-600">
            Status
            <select
              value={form.vehicleType}
              onChange={(event) => setForm({ ...form, vehicleType: event.target.value as 'Stock' | 'Demo' })}
              className={`mt-1 w-full rounded-lg px-3 py-2 font-medium text-white ${form.vehicleType === 'Demo' ? 'bg-red-600' : 'bg-green-600'}`}
            >
              <option value="Stock">Stock</option>
              <option value="Demo">Demo</option>
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Invoice date
            <input
              required
              type="date"
              value={form.invoiceDate}
              onChange={(event) => setForm({ ...form, invoiceDate: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="text-sm text-gray-600">
            Financing date
            <input
              required
              type="date"
              value={form.financingDate}
              onChange={(event) => setForm({ ...form, financingDate: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <label className="text-sm text-gray-600">
            Outstanding amount
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.outstandingAmount}
              onChange={(event) => setForm({ ...form, outstandingAmount: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add to list'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading vehicles...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Day</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">90 days</th>
                  <th className="px-4 py-3 font-medium">360 days</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Interest</th>
                  <th className="px-4 py-3 font-medium">Closing</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className={vehicle.soldAt ? 'bg-gray-50 text-gray-400' : 'border-t border-gray-100'}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{vehicle.vin}</p>
                      <p className="text-xs text-gray-500">
                        {vehicle.invoiceNumber}
                        {vehicle.soldAt ? ' · Sold' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={vehicle.vehicleType === 'Demo' ? 'Demo' : 'Stock'}
                        onChange={(event) => updateType(vehicle, event.target.value as 'Stock' | 'Demo')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${vehicle.vehicleType === 'Demo' ? 'bg-red-600' : 'bg-green-600'}`}
                      >
                        <option value="Stock">Stock</option>
                        <option value="Demo">Demo</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 font-medium">{vehicle.dayNumber}</td>
                    <td className="px-4 py-3">{vehicle.status}</td>
                    <td className="px-4 py-3">
                      <p className={`font-semibold ${vehicle.soldAt ? 'text-gray-400' : dayClass(vehicle.daysTo90)}`}>
                        {dayText(vehicle.daysTo90)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(vehicle.day90)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-semibold ${vehicle.soldAt ? 'text-gray-400' : dayClass(vehicle.daysTo360)}`}>
                        {dayText(vehicle.daysTo360)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(vehicle.day360)}</p>
                    </td>
                    <td className="px-4 py-3">{formatMoney(vehicle.outstandingAmount)}</td>
                    <td className="px-4 py-3">{formatMoney(vehicle.interestToDate)}</td>
                    <td className="px-4 py-3">{formatMoney(vehicle.closingBalance)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={savingId === vehicle.id}
                        onClick={() => markSold(vehicle, !vehicle.soldAt)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {vehicle.soldAt ? 'Undo sold' : 'Mark sold'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
