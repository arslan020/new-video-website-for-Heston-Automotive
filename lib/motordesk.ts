const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'] as const;

export type MotorDeskCustomer = {
  id: number;
  title: string;
  name: string;
  email: string;
  mobile: string;
  address: string;
};

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'number' in value) {
    return String((value as { number?: unknown }).number || '').trim();
  }
  return '';
}

function ukNational(value: unknown): string {
  let digits = asText(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('44')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 11);
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  const first = parts[0]?.replace(/\./g, '') || '';
  const title = TITLES.find((item) => item.toLowerCase() === first.toLowerCase());
  if (title && parts.length > 1) return { title, name: parts.slice(1).join(' ') };
  return { title: '', name: full.trim() };
}

function formatAddress(address: unknown) {
  if (!address || typeof address !== 'object') return '';
  const row = address as Record<string, unknown>;
  return [row.line1, row.line2, row.line3, row.city, row.state, row.zip]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

function mapContact(contact: Record<string, unknown>): MotorDeskCustomer | null {
  const data = contact.data && typeof contact.data === 'object' ? contact.data as Record<string, unknown> : {};
  const fullName = asText(data.name);
  if (!fullName && !asText(contact.email)) return null;
  const { title, name } = splitName(fullName || asText(contact.email));
  const mobile = ukNational(data.mobile) || ukNational(data.telephone);
  return {
    id: Number(contact.id) || 0,
    title,
    name,
    email: asText(contact.email),
    mobile,
    address: formatAddress(data.address),
  };
}

async function motorDeskFetch(path: string, init?: RequestInit) {
  const key = process.env.MOTORDESK_API_KEY;
  if (!key) throw new Error('Motor Desk is not configured');
  const res = await fetch(`https://api.motordesk.com/2.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof body?.error?.message === 'string' ? body.error.message : 'Motor Desk request failed';
    throw new Error(message);
  }
  return body;
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mapMotorDeskVehicle(record: Record<string, unknown>, registration: string) {
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record;
  const vehicle = data.vehicle && typeof data.vehicle === 'object' ? data.vehicle as Record<string, unknown> : {};
  const history = data.history && typeof data.history === 'object' ? data.history as Record<string, unknown> : {};
  const stock = data.stock && typeof data.stock === 'object' ? data.stock as Record<string, unknown> : {};
  const lookup = data.lookup && typeof data.lookup === 'object' ? data.lookup as Record<string, unknown> : {};
  const dvla = lookup.dvla && typeof lookup.dvla === 'object' ? lookup.dvla as Record<string, unknown> : {};
  const make = textOf(vehicle.make) || textOf(dvla.make);
  const model = textOf(vehicle.model);
  if (!make && !model) return null;
  const mileage = Number(vehicle.mileage);
  return {
    registration: textOf(record.registration) || registration,
    make,
    model,
    derivative: textOf(vehicle.derivative),
    bodyType: textOf(vehicle.body),
    fuelType: textOf(vehicle.fuel) || textOf(dvla.fuelType),
    transmissionType: textOf(vehicle.transmission),
    colour: textOf(vehicle.colour_name) || textOf(vehicle.colour) || textOf(dvla.colour),
    firstRegistrationDate: textOf(vehicle.registered) || textOf(dvla.monthOfFirstRegistration),
    yearOfManufacture: history.year || dvla.yearOfManufacture || null,
    odometerReadingMiles: vehicle.mileage == null || vehicle.mileage === '' || !Number.isFinite(mileage) ? null : mileage,
    vin: textOf(stock.vin),
    seats: vehicle.seats ?? null,
  };
}

export async function lookupMotorDeskVehicle(registration: string) {
  const reg = registration.replace(/\s/g, '').toUpperCase();
  if (reg.length < 2) return null;

  const listed = await motorDeskFetch(`/vehicles?${new URLSearchParams({
    per_page: '1',
    view: 'full',
    registration: reg,
  })}`);
  const stock = Array.isArray(listed?.data) ? listed.data[0] : null;
  if (stock) {
    const mapped = mapMotorDeskVehicle(stock, reg);
    if (mapped) return mapped;
  }

  const lookup = await motorDeskFetch('/vehicle-lookups', {
    method: 'POST',
    body: JSON.stringify({
      type: 'UK',
      identifier: reg,
      mot: false,
      features: false,
      basic_check: false,
      factory_fitted: false,
      full_check: false,
    }),
  });
  const details = lookup?.data?.data;
  if (!details || typeof details !== 'object') return null;
  return mapMotorDeskVehicle({ registration: lookup.data.registration, data: details }, reg);
}

async function fetchContacts(params: URLSearchParams) {
  const body = await motorDeskFetch(`/contacts?${params}`);
  const rows = Array.isArray(body?.data) ? body.data : [];
  return rows
    .map((row: Record<string, unknown>) => mapContact(row))
    .filter((row: MotorDeskCustomer | null): row is MotorDeskCustomer => Boolean(row));
}

export async function searchMotorDeskCustomers(query: string, limit = 8) {
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, '');
  const compact = q.replace(/\s/g, '');
  const perPage = String(Math.min(20, Math.max(1, limit)));
  const params = new URLSearchParams({ per_page: perPage, view: 'full' });
  if (q.includes('@')) params.set('email', `%${q}%`);
  else if (digits.length >= 6 && digits.length >= compact.length - 1) params.set('mobile', `%${digits}%`);
  else params.set('name', `%${q}%`);

  const matches = await fetchContacts(params);
  if (matches.length > 0 || !params.has('mobile')) return matches;
  params.delete('mobile');
  params.set('telephone', `%${digits}%`);
  return fetchContacts(params);
}

export async function getMotorDeskCustomer(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const body = await motorDeskFetch(`/contacts/${id}?view=full`);
  const row = body?.data;
  if (!row || typeof row !== 'object') return null;
  return mapContact(row as Record<string, unknown>);
}

export async function soldPricesForVins(vins: string[]) {
  const wanted = new Set(vins.map((vin) => vin.trim().toUpperCase()).filter(Boolean));
  const best = new Map<string, { price: number; rank: number; paid: number }>();
  if (wanted.size === 0) return {} as Record<string, number>;

  for (let page = 1; page <= 20; page += 1) {
    const body = await motorDeskFetch(`/invoices?${new URLSearchParams({
      per_page: '100',
      page: String(page),
      view: 'full',
      fields: 'status.name,paid,totals.total_sale,vehicle_snapshot.vin',
    })}`);
    const rows = Array.isArray(body?.data) ? body.data as Record<string, unknown>[] : [];
    for (const row of rows) {
      const snapshot = row.vehicle_snapshot && typeof row.vehicle_snapshot === 'object'
        ? row.vehicle_snapshot as Record<string, unknown>
        : {};
      const vin = textOf(snapshot.vin).toUpperCase();
      if (!wanted.has(vin)) continue;
      const status = row.status && typeof row.status === 'object'
        ? textOf((row.status as Record<string, unknown>).name)
        : '';
      const rank = status === 'paid' ? 2 : status === 'issued' ? 1 : 0;
      if (rank === 0) continue;
      const totals = row.totals && typeof row.totals === 'object' ? row.totals as Record<string, unknown> : {};
      const price = Number(totals.total_sale);
      if (!Number.isFinite(price) || price <= 0) continue;
      const paid = Number(row.paid) || 0;
      const current = best.get(vin);
      if (!current || rank > current.rank || (rank === current.rank && paid >= current.paid)) {
        best.set(vin, { price, rank, paid });
      }
    }
    if (rows.length < 100) break;
  }

  return Object.fromEntries([...best].map(([vin, value]) => [vin, value.price]));
}
