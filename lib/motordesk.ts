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

export type MotorDeskStockVehicle = {
  id: number;
  registration: string;
  status: string;
  make: string;
  model: string;
  derivative: string;
  fuelType: string;
  transmissionType: string;
  colour: string;
  mileage: number | null;
  vin: string;
  image: string;
};

const HIDDEN_STOCK = new Set(['deleted', 'rejected']);

function photoUrl(media: unknown) {
  if (!media || typeof media !== 'object') return '';
  const photo = (media as { photo?: unknown }).photo;
  const first = Array.isArray(photo) ? photo[0] : photo;
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const row = first as Record<string, unknown>;
    return textOf(row.url) || textOf(row.href) || textOf(row.src);
  }
  return '';
}

function mapStockVehicle(row: Record<string, unknown>): MotorDeskStockVehicle | null {
  const status = row.status && typeof row.status === 'object'
    ? textOf((row.status as Record<string, unknown>).name)
    : textOf(row.status);
  if (!status || HIDDEN_STOCK.has(status)) return null;
  const data = row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : {};
  const vehicle = data.vehicle && typeof data.vehicle === 'object' ? data.vehicle as Record<string, unknown> : {};
  const stock = data.stock && typeof data.stock === 'object' ? data.stock as Record<string, unknown> : {};
  const registration = textOf(row.registration).replace(/\s/g, '').toUpperCase();
  const make = textOf(vehicle.make);
  const model = textOf(vehicle.model);
  if (!registration && !make && !model) return null;
  const mileage = Number(vehicle.mileage);
  return {
    id: Number(row.id) || 0,
    registration,
    status,
    make,
    model,
    derivative: textOf(vehicle.derivative),
    fuelType: textOf(vehicle.fuel),
    transmissionType: textOf(vehicle.transmission),
    colour: textOf(vehicle.colour_name) || textOf(vehicle.colour),
    mileage: vehicle.mileage == null || vehicle.mileage === '' || !Number.isFinite(mileage) ? null : mileage,
    vin: textOf(stock.vin),
    image: photoUrl(row.media),
  };
}

export async function listMotorDeskStock() {
  const stock: MotorDeskStockVehicle[] = [];
  const sold: MotorDeskStockVehicle[] = [];
  for (let page = 1; page <= 8; page += 1) {
    const body = await motorDeskFetch(`/vehicles?${new URLSearchParams({
      per_page: '100',
      page: String(page),
      view: 'full',
      fields: 'id,registration,status.name,media.photo,data.vehicle.make,data.vehicle.model,data.vehicle.derivative,data.vehicle.fuel,data.vehicle.transmission,data.vehicle.colour_name,data.vehicle.mileage,data.stock.vin',
    })}`);
    const rows = Array.isArray(body?.data) ? body.data as Record<string, unknown>[] : [];
    for (const row of rows) {
      const vehicle = mapStockVehicle(row);
      if (!vehicle) continue;
      if (vehicle.status === 'sold') sold.push(vehicle);
      else stock.push(vehicle);
    }
    if (rows.length < 100) break;
  }
  return { stock, sold };
}

export type MotorDeskLead = {
  id: number;
  title: string;
  name: string;
  email: string;
  mobile: string;
  status: string;
  summary: string;
  message: string;
  created: number;
  registration: string;
  make: string;
  model: string;
  derivative: string;
  image: string;
};

function unixSeconds(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

function messageOf(data: Record<string, unknown>) {
  const message = data.message;
  if (typeof message === 'string') return message.trim();
  if (message && typeof message === 'object') {
    const row = message as Record<string, unknown>;
    return textOf(row.text) || textOf(row.m) || textOf(row.body);
  }
  return '';
}

function vehicleBits(value: unknown) {
  const empty = { id: 0, registration: '', make: '', model: '', derivative: '', image: '' };
  if (typeof value === 'number' && value > 0) return { ...empty, id: value };
  if (!value || typeof value !== 'object') return empty;
  const row = value as Record<string, unknown>;
  const nested = row.data && typeof row.data === 'object'
    ? ((row.data as Record<string, unknown>).vehicle && typeof (row.data as Record<string, unknown>).vehicle === 'object'
      ? (row.data as Record<string, unknown>).vehicle as Record<string, unknown>
      : row)
    : (row.vehicle && typeof row.vehicle === 'object' ? row.vehicle as Record<string, unknown> : row);
  const id = Number(row.id || row.vehicle || nested.id) || 0;
  const registration = textOf(row.registration || nested.registration || row.vrm || nested.vrm).replace(/\s/g, '').toUpperCase();
  return {
    id: Number.isInteger(id) && id > 0 ? id : 0,
    registration,
    make: textOf(nested.make || row.make),
    model: textOf(nested.model || row.model),
    derivative: textOf(nested.derivative || row.derivative),
    image: photoUrl(row.media),
  };
}

function mapLead(row: Record<string, unknown>): MotorDeskLead | null {
  const status = row.status && typeof row.status === 'object'
    ? textOf((row.status as Record<string, unknown>).name)
    : textOf(row.status);
  if (status === 'junk') return null;
  if (unixSeconds(row.anonymised) > 0) return null;
  const fullName = textOf(row.name);
  if (fullName.toLowerCase() === 'anonymised') return null;
  const data = row.data && typeof row.data === 'object' ? row.data as Record<string, unknown> : {};
  const vehicle = vehicleBits(data.vehicle);
  const { title, name } = splitName(fullName);
  return {
    id: Number(row.id) || 0,
    title,
    name: name || fullName,
    email: asText(row.email),
    mobile: ukNational(row.mobile) || ukNational(row.phone),
    status: status || 'new',
    summary: textOf(row.summary),
    message: messageOf(data),
    created: unixSeconds(row.created) || unixSeconds(row.updated),
    registration: vehicle.registration,
    make: vehicle.make,
    model: vehicle.model,
    derivative: vehicle.derivative,
    image: vehicle.image,
    vehicleId: vehicle.id,
  } as MotorDeskLead & { vehicleId: number };
}

async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function leadRows(body: { data?: unknown }) {
  return Array.isArray(body?.data) ? body.data as Record<string, unknown>[] : [];
}

function leadTotal(body: { meta?: unknown }) {
  const meta = body?.meta && typeof body.meta === 'object' ? body.meta as Record<string, unknown> : {};
  const pagination = meta.pagination && typeof meta.pagination === 'object' ? meta.pagination as Record<string, unknown> : {};
  const total = Number(pagination.total ?? meta.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}

async function vehicleBrief(id: number) {
  let body: { data?: unknown };
  try {
    body = await motorDeskFetch(`/vehicles/${id}?${new URLSearchParams({
      view: 'full',
      fields: 'id,registration,media.photo,data.vehicle.make,data.vehicle.model,data.vehicle.derivative',
    })}`);
  } catch {
    body = await motorDeskFetch(`/vehicles/${id}?view=full`);
  }
  const row = body?.data;
  if (!row || typeof row !== 'object') return null;
  return vehicleBits(row);
}

export async function listMotorDeskLeads() {
  const perPage = 80;
  const stockPromise = listMotorDeskStock().catch(() => ({ stock: [], sold: [] }));
  const first = await motorDeskFetch(`/leads?${new URLSearchParams({ per_page: String(perPage), page: '1', view: 'full' })}`);
  let rows = leadRows(first);
  const total = leadTotal(first);
  const lastPage = Math.max(1, Math.ceil((total || rows.length) / perPage));
  if (lastPage > 1) {
    const tail = await motorDeskFetch(`/leads?${new URLSearchParams({ per_page: String(perPage), page: String(lastPage), view: 'full' })}`);
    const tailRows = leadRows(tail);
    const newestFirst = Math.max(0, ...rows.map((row) => unixSeconds(row.created)));
    const newestTail = Math.max(0, ...tailRows.map((row) => unixSeconds(row.created)));
    if (newestTail > newestFirst) {
      rows = tailRows;
      if (tailRows.length < perPage && lastPage > 2) {
        const prev = await motorDeskFetch(`/leads?${new URLSearchParams({ per_page: String(perPage), page: String(lastPage - 1), view: 'full' })}`);
        rows = rows.concat(leadRows(prev));
      }
    }
  }

  const leads = rows
    .map((row) => mapLead(row))
    .filter((lead): lead is MotorDeskLead & { vehicleId: number } => Boolean(lead))
    .sort((a, b) => b.created - a.created)
    .slice(0, perPage);

  let canReadLeadVehicles = true;
  await eachLimit(leads.filter((lead) => !lead.registration && !lead.vehicleId), 6, async (lead) => {
    if (!canReadLeadVehicles || !lead.id) return;
    try {
      const body = await motorDeskFetch(`/leads/${lead.id}/vehicles`);
      const link = leadRows(body)[0];
      const id = Number(link?.vehicle) || 0;
      if (id > 0) lead.vehicleId = id;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('scope')) canReadLeadVehicles = false;
    }
  });

  const cache = new Map<number, { registration: string; make: string; model: string; derivative: string; image: string } | null>();
  await eachLimit(leads.filter((lead) => lead.vehicleId && (!lead.registration || !lead.make)), 6, async (lead) => {
    if (!cache.has(lead.vehicleId)) cache.set(lead.vehicleId, await vehicleBrief(lead.vehicleId).catch(() => null));
    const vehicle = cache.get(lead.vehicleId);
    if (!vehicle) return;
    if (!lead.registration) lead.registration = vehicle.registration;
    if (!lead.make) lead.make = vehicle.make;
    if (!lead.model) lead.model = vehicle.model;
    if (!lead.derivative) lead.derivative = vehicle.derivative;
    if (!lead.image) lead.image = vehicle.image;
  });

  const listed = await stockPromise;
  const images = new Map<string, string>();
  for (const vehicle of [...listed.stock, ...listed.sold]) {
    if (vehicle.registration && vehicle.image) images.set(vehicle.registration, vehicle.image);
  }
  for (const lead of leads) {
    if (!lead.image && lead.registration) lead.image = images.get(lead.registration) || '';
  }

  return leads.map(({ vehicleId: _vehicleId, ...lead }) => lead);
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
