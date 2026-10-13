export const TRACKING_STAGES = [
  'Reserved',
  'Booking Confirmed',
  'Paperwork',
  'PDI / Prep',
  'Ready for Handover',
] as const;

export const TRACKING_STAGE_DESCRIPTIONS: Record<number, string> = {
  0: 'Your vehicle has been reserved for you.',
  1: 'Your booking has been confirmed.',
  2: 'We are processing your finance and paperwork.',
  3: 'Your vehicle is undergoing pre-delivery inspection and preparation.',
  4: 'Your vehicle is ready. We will contact you to arrange handover.',
};

export function isValidStage(stage: number): boolean {
  return Number.isInteger(stage) && stage >= 0 && stage < TRACKING_STAGES.length;
}
