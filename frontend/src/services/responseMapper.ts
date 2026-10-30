/**
 * Transform MongoDB _id to id for frontend consistency
 */
export const mapId = (obj: any): any => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map(mapId);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const mapped = { ...obj };

  // Transform _id to id
  if (mapped._id) {
    mapped.id = mapped._id;
    delete mapped._id;
  }

  // Recursively map nested objects
  Object.keys(mapped).forEach((key) => {
    if (mapped[key] && typeof mapped[key] === 'object') {
      mapped[key] = mapId(mapped[key]);
    }
  });

  return mapped;
};

/**
 * Transform GeoJSON coordinates to simple format
 * From: { type: 'Point', coordinates: [lng, lat] }
 * To: { lat, lng }
 */
export const mapCoordinates = (geoJson: any): { lat: number; lng: number } | null => {
  if (!geoJson?.coordinates || !Array.isArray(geoJson.coordinates)) {
    return null;
  }

  const [lng, lat] = geoJson.coordinates;
  return { lat, lng };
};

/**
 * Transform location object
 */
export const mapLocation = (location: any) => {
  if (!location) return null;

  return {
    name: location.name,
    address: location.address,
    coordinates: mapCoordinates(location.coordinates),
  };
};

/**
 * Transform ride object
 */
export const mapRide = (ride: any) => {
  if (!ride) return null;

  // Map vehicle object - transform backend fields to frontend expected fields
  const mapVehicle = (vehicle: any) => {
    if (!vehicle) return null;
    return {
      type: vehicle.type,
      model: vehicle.name || vehicle.model, // backend sends 'name', frontend expects 'model'
      numberPlate: vehicle.registrationNumber || vehicle.numberPlate, // backend sends 'registrationNumber', frontend expects 'numberPlate'
      color: vehicle.color,
      seatingCapacity: vehicle.seatingCapacity,
    };
  };

  return {
    ...mapId(ride),
    pickup: mapLocation(ride.pickup),
    dropoff: mapLocation(ride.dropoff),
    departureTime: ride.schedule?.departureAt,
    date: ride.schedule?.date,
    time: ride.schedule?.time,
    vehicle: mapVehicle(ride.vehicle),
    vehicleModel: ride.vehicle?.name || ride.vehicleModel, // fallback for direct access
    vehicleNumber: ride.vehicle?.registrationNumber || ride.vehicleNumber, // fallback for direct access
  };
};

/**
 * Transform booking object — normalises all fields the BookingCard expects
 */
export const mapBooking = (booking: any) => {
  if (!booking) return null;

  const base = mapId(booking);

  // ── Ride info (populated rideId object or flat fields) ──────────────────────
  const ride = base.rideId && typeof base.rideId === 'object' ? base.rideId : null;
  // Always expose a plain string rideId for API calls
  const rideIdString: string | null = ride
    ? (ride.id || ride._id || null)
    : (typeof base.rideId === 'string' ? base.rideId : null);

  // ── Departure date / time ────────────────────────────────────────────────────
  const rawDeparture =
    base.rideTime ||
    ride?.schedule?.departureAt ||
    ride?.departureAt ||
    base.bookingTime ||
    null;

  let date = base.date || ride?.schedule?.date || '';
  let time = base.time || ride?.schedule?.time || '';

  if (rawDeparture && (!date || !time)) {
    const d = new Date(rawDeparture);
    if (!isNaN(d.getTime())) {
      if (!date) {
        date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      if (!time) {
        time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }
  }

  // ── Price ────────────────────────────────────────────────────────────────────
  const price =
    base.price ??
    base.totalAmount ??
    base.fareAmount ??
    ride?.farePerSeat ??
    0;

  // ── Seats ────────────────────────────────────────────────────────────────────
  const seats =
    base.seats ??
    base.seatsBooked ??
    base.passengersCount ??
    1;

  // ── Pickup / drop locations ──────────────────────────────────────────────────
  const pickupRaw = base.pickup || ride?.pickup;
  const dropRaw   = base.dropoff || base.drop || ride?.dropoff;

  const pickup = pickupRaw
    ? (typeof pickupRaw === 'string' ? pickupRaw : mapLocation(pickupRaw))
    : null;
  const drop = dropRaw
    ? (typeof dropRaw === 'string' ? dropRaw : mapLocation(dropRaw))
    : null;

  // ── Driver info (populated driverId or nested driver object) ─────────────────
  const rawDriver =
    base.driver ||
    (base.driverId && typeof base.driverId === 'object' ? base.driverId : null) ||
    (ride?.driverId && typeof ride.driverId === 'object' ? ride.driverId : null);

  const driver = rawDriver
    ? {
        ...mapId(rawDriver),
        name:   rawDriver.name   || rawDriver.fullName || 'Driver',
        avatar: rawDriver.profilePhoto || rawDriver.avatar || rawDriver.photo || null,
        phone:  rawDriver.phone  || rawDriver.phoneNumber || null,
        rating: rawDriver.rating ?? null,
      }
    : null;

  // ── Passenger info ───────────────────────────────────────────────────────────
  const rawPassenger =
    base.passenger ||
    (base.passengerId && typeof base.passengerId === 'object' ? base.passengerId : null);

  const passenger = rawPassenger
    ? {
        ...mapId(rawPassenger),
        name:   rawPassenger.name   || rawPassenger.fullName || 'Passenger',
        avatar: rawPassenger.profilePhoto || rawPassenger.avatar || rawPassenger.photo || null,
        phone:  rawPassenger.phone  || rawPassenger.phoneNumber || null,
        rating: rawPassenger.rating ?? null,
      }
    : null;

  // ── Vehicle info (from populated ride) ─────────────────────────────────────
  const rawVehicle = ride?.vehicle;
  const vehicle = rawVehicle
    ? {
        type: rawVehicle.type,
        model: rawVehicle.name || rawVehicle.model,
        numberPlate: rawVehicle.registrationNumber || rawVehicle.numberPlate,
        color: rawVehicle.color,
        seatingCapacity: rawVehicle.seatingCapacity,
      }
    : null;

  // ── Status normalisation (backend uses UPPER_CASE, UI uses lower_case) ───────
  const rawStatus = base.status || 'pending';
  const status = rawStatus.toLowerCase();

  return {
    ...base,
    // normalised fields
    date,
    time,
    price,
    seats,
    pickup,
    drop,
    driver,
    passenger,
    vehicle,
    vehicleModel: rawVehicle?.name || rawVehicle?.model || base.vehicleModel,
    vehicleNumber: rawVehicle?.registrationNumber || rawVehicle?.numberPlate || base.vehicleNumber,
    status,
    // keep originals accessible
    rideTime: base.rideTime,
    bookingTime: base.bookingTime,
    otpCode: base.otpCode || ride?.otpCode || null,
    // Always expose a plain string rideId so API calls don't get [object Object]
    rideId: rideIdString || base.rideId,
  };
};

/**
 * Transform user object
 */
export const mapUser = (user: any) => {
  if (!user) return null;

  return {
    ...mapId(user),
    userId: user.userId || user.id,
    avatar: user.profilePhoto || user.avatar,
    isPhoneVerified: user.isPhoneVerified ?? false,
    isEmailVerified: user.isEmailVerified ?? false,
    faceVerified: user.faceVerified ?? false,
  };
};

/**
 * Transform payment/transaction object
 */
export const mapTransaction = (transaction: any) => {
  if (!transaction) return null;

  return {
    ...mapId(transaction),
    createdAt: transaction.createdAt || transaction.timestamp,
  };
};

/**
 * Transform message object
 */
export const mapMessage = (message: any) => {
  if (!message) return null;

  return {
    ...mapId(message),
    sender: mapId(message.sender),
    createdAt: message.createdAt || message.timestamp,
  };
};

/**
 * Transform conversation object
 */
export const mapConversation = (conversation: any) => {
  if (!conversation) return null;

  return {
    ...mapId(conversation),
    participant: mapId(conversation.participant),
    lastMessage: mapMessage(conversation.lastMessage),
  };
};

/**
 * Transform notification object
 */
export const mapNotification = (notification: any) => {
  if (!notification) return null;

  return {
    ...mapId(notification),
    createdAt: notification.createdAt || notification.timestamp,
  };
};

/**
 * Transform emergency contact object
 */
export const mapEmergencyContact = (contact: any) => {
  if (!contact) return null;

  return {
    ...mapId(contact),
  };
};

/**
 * Transform KYC object
 */
export const mapKYC = (kyc: any) => {
  if (!kyc) return null;

  return {
    ...mapId(kyc),
    status: kyc.kycStatus || kyc.status,
    documents: kyc.kycDocuments || kyc.documents,
  };
};

/**
 * Transform wallet object
 */
export const mapWallet = (wallet: any) => {
  if (!wallet) return null;

  return {
    ...mapId(wallet),
    balance: wallet.balance || wallet.walletBalance,
  };
};

/**
 * Generic response mapper
 */
export const mapResponse = <T>(data: any, mapper?: (item: any) => T): T => {
  if (mapper) {
    return mapper(data);
  }
  return mapId(data);
};

/**
 * Map array of items
 */
export const mapArray = <T>(items: any[], mapper?: (item: any) => T): T[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  if (mapper) {
    return items.map(mapper);
  }

  return items.map(mapId);
};
