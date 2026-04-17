import { NextRequest } from 'next/server';
import axios from 'axios';
import { connectDB } from '@/lib/mongodb';
import Stock from '@/models/Stock';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ registration: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { registration } = await params;
    const reg = registration.replace(/\s/g, '').toUpperCase();
    const advertiserId = process.env.AUTOTRADER_ADVERTISER_ID!;

    const stockRecord = await Stock.findOne({ advertiserId });
    if (stockRecord?.stockData) {
      const localVehicle = (stockRecord.stockData as Array<{ vehicle: { registration: string } }>).find(
        (item) => item.vehicle.registration.replace(/\s/g, '').toUpperCase() === reg
      );
      if (localVehicle) {
        return Response.json({ source: 'local', ...localVehicle });
      }
    }

    // UKVD fallback
    const ukvdKey = process.env.UKVD_API_KEY;
    const ukvdPackage = process.env.UKVD_PACKAGE || 'VehicleDetails';
    const ukvdEndpoint = process.env.UKVD_ENDPOINT || 'https://uk.api.vehicledataglobal.com/r2/lookup';

    if (ukvdKey) {
      try {
        const ukvdResponse = await axios.get(ukvdEndpoint, { params: { apiKey: ukvdKey, packageName: ukvdPackage, vrm: reg } });
        const data = ukvdResponse.data;

        if (data?.Results?.VehicleDetails) {
          const vIdent = data.Results.VehicleDetails.VehicleIdentification || {};
          const vTech = data.Results.VehicleDetails.DvlaTechnicalDetails || {};
          const vHistory = data.Results.VehicleDetails.VehicleHistory || {};
          const vStatus = data.Results.VehicleDetails.VehicleStatus || {};

          const vehicle = {
            registration: vIdent.Vrm || reg,
            make: vIdent.DvlaMake,
            model: vIdent.DvlaModel,
            bodyType: vIdent.DvlaBodyType,
            fuelType: vIdent.DvlaFuelType,
            colour: vHistory.ColourDetails?.CurrentColour || '',
            engineCapacityCC: vTech.EngineCapacityCc,
            seats: vTech.NumberOfSeats,
            firstRegistrationDate: vIdent.DateFirstRegistered,
            yearOfManufacture: vIdent.YearOfManufacture,
            co2EmissionGPKM: vStatus.VehicleExciseDutyDetails?.DvlaCo2,
          };

          return Response.json({ source: 'ukvd', vehicle, features: [], media: { images: [] } });
        }
      } catch (ukvdErr) {
        console.error('UKVD error:', ukvdErr);
      }
    }

    return Response.json({ message: 'Vehicle not found in stock or external database.' }, { status: 404 });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to lookup vehicle' }, { status: 500 });
  }
}
