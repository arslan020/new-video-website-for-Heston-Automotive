export const TRACKING_STAGES = [
  'Order Confirmed',
  'Vehicle Allocated / In Transit',
  'Vehicle Arrival',
  'Finance Signed / Outstanding Balance',
  'PDI / Preparation',
  'Vehicle Protection',
  'Ready for Collection',
  'Handover Complete',
] as const;

export const TRACKING_STAGE_DESCRIPTIONS: Record<number, string> = {
  0: 'Your order has been confirmed.',
  1: 'Your vehicle has been allocated and is in transit.',
  2: 'Your vehicle has arrived with us.',
  3: 'Finance has been signed and we are settling any outstanding balance.',
  4: 'Your vehicle is undergoing pre-delivery inspection and preparation.',
  5: 'Your vehicle is having its protection treatment applied.',
  6: 'Your vehicle is ready for collection.',
  7: 'Handover is complete. Enjoy your new car!',
};

export function isValidStage(stage: number): boolean {
  return Number.isInteger(stage) && stage >= 0 && stage < TRACKING_STAGES.length;
}
