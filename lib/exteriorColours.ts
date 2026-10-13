export interface ExteriorColour {
  name: string;
  image: string;
  swatch: string;
}

const S05: ExteriorColour[] = [
  { name: 'Ganymede Grey', image: '/models/deepal-s05/side-grey.png', swatch: '/swatches/s05-grey.png' },
  { name: 'Deep Space Black', image: '/models/deepal-s05/side-black.png', swatch: '/swatches/s05-black.png' },
  { name: 'Moonlight White', image: '/models/deepal-s05/side-white.png', swatch: '/swatches/s05-white.png' },
  { name: 'Mercury Silver', image: '/models/deepal-s05/side-silver.png', swatch: '/swatches/s05-silver.png' },
  { name: 'Andromeda Blue', image: '/models/deepal-s05/side-blue.png', swatch: '/swatches/s05-blue.png' },
];

const S05_PHEV: ExteriorColour[] = [
  { name: 'Mercury Silver', image: '/models/deepal-s05-ultra-phev/side-silver.png', swatch: '/swatches/s05-silver.png' },
  { name: 'Ganymede Grey', image: '/models/deepal-s05-ultra-phev/side-grey.png', swatch: '/swatches/s05-grey.png' },
  { name: 'Deep Space Black', image: '/models/deepal-s05-ultra-phev/side-black.png', swatch: '/swatches/s05-black.png' },
  { name: 'Moonlight White', image: '/models/deepal-s05-ultra-phev/side-white.png', swatch: '/swatches/s05-white.png' },
  { name: 'Andromeda Blue', image: '/models/deepal-s05-ultra-phev/side-blue.png', swatch: '/swatches/s05-blue.png' },
];

const S07: ExteriorColour[] = [
  { name: 'Comet White', image: '/models/deepal-s07/side-white.png', swatch: '/swatches/s07-white.png' },
  { name: 'Sunset Orange', image: '/models/deepal-s07/side-orange.png', swatch: '/swatches/s07-orange.png' },
  { name: 'Eclipse Black', image: '/models/deepal-s07/side-black.png', swatch: '/swatches/s07-black.png' },
  { name: 'Lunar Grey', image: '/models/deepal-s07/side-grey.png', swatch: '/swatches/s07-grey.png' },
  { name: 'Nebula Green', image: '/models/deepal-s07/side-green.png', swatch: '/swatches/s07-green.png' },
];

export function coloursForVehicle(model?: string, derivative?: string): ExteriorColour[] {
  const text = `${model || ''} ${derivative || ''}`.toLowerCase();
  if (text.includes('s07')) return S07;
  if (text.includes('phev') || text.includes('ultra')) return S05_PHEV;
  if (text.includes('s05')) return S05;
  return [];
}

export function findExteriorColour(model?: string, derivative?: string, colour?: string): ExteriorColour | undefined {
  return matchStockColour(model, derivative, colour);
}

export function matchStockColour(model?: string, derivative?: string, colour?: string): ExteriorColour | undefined {
  const options = coloursForVehicle(model, derivative);
  if (!colour || options.length === 0) return undefined;
  const wanted = colour.trim().toLowerCase();
  const exact = options.find((entry) => entry.name.toLowerCase() === wanted);
  if (exact) return exact;

  const hints = ['silver', 'grey', 'gray', 'black', 'white', 'blue', 'orange', 'green'];
  for (const hint of hints) {
    if (!wanted.includes(hint)) continue;
    const needle = hint === 'gray' ? 'grey' : hint;
    const hit = options.find((entry) => entry.name.toLowerCase().includes(needle));
    if (hit) return hit;
  }
  return undefined;
}
