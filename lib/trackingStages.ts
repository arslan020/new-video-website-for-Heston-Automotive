export const TRACKING_STAGES = [
  'Order Confirmed',
  'Vehicle Allocated / In Transit',
  'Vehicle Arrived',
  'Finance E-Sign / Outstanding Balance',
  'Pre-Delivery Inspection / Preparation',
  'Vehicle Protection',
  'Ready for Collection',
  'Handover Complete',
] as const;

export const TRACKING_STAGE_CUSTOMER_LABELS = [
  'Order Confirmed',
  'Vehicle Allocated / In Transit',
  'Vehicle Arrived',
  'Finance E-Sign / Outstanding Balance',
  'Pre-Delivery Inspection / Preparation',
  'Vehicle Protection',
  'Ready for Collection',
  'Handover Complete',
] as const;

export const TRACKING_STAGE_DESCRIPTIONS: Record<number, string> = {
  0: 'Your order is officially confirmed! We have successfully received your request and are preparing the next steps for your new vehicle.',
  1: 'Great news, your vehicle is on its way! Your specific car has been secured and is officially en route to our dealership.',
  2: 'Your vehicle is officially here! It has arrived safely at our facility. A member of our team will be in contact with you on the next steps.',
  3: 'Time to finalize your paperwork and payment. Please complete your digital finance signing and settle any remaining balance so we can prepare your handover.',
  4: 'Your vehicle is undergoing its final showroom-ready checks! Our factory-trained technicians are completing a comprehensive Pre-Delivery Inspection (PDI) and detailing your car so it is pristine for your arrival.',
  5: 'Protecting your new vehicle for the road ahead. Our team is booking or applying protective coatings/plans to keep your car looking brand new. If you didn\'t add protection to your order, you can still secure it by contacting your specialist today.',
  6: 'The moment you have been waiting for. Your new car is ready for collection! Please ensure you have your handover appointment scheduled so we can hand you the keys to your new car.',
  7: 'Congratulations on your new vehicle!',
};

export const FINANCE_STEP_COMPLETE_DESCRIPTION =
  'All paperwork and payments are complete! Your finance documents have been successfully signed and the remaining balance is fully cleared.';

export const GOOGLE_REVIEW_URL = 'https://g.page/r/CeOqn_SwMOs6EAE/review';

export function isValidStage(stage: number): boolean {
  return Number.isInteger(stage) && stage >= 0 && stage < TRACKING_STAGES.length;
}
