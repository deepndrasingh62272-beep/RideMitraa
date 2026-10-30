/**
 * Vehicle seat rules.
 *
 * totalSeats = full seating capacity of the vehicle (including driver).
 * availableSeats = seats offered to passengers (driver seat excluded).
 *
 * BIKE  → always 1 passenger seat, totalSeats must be 2
 * CAR   → covers SEDAN, HATCHBACK, SUV, VAN, AUTO
 *         availableSeats = totalSeats - 1  (driver always occupies one seat)
 *         Hard caps per category prevent unrealistic values.
 */

// Maps vehicle type → allowed totalSeats values
const SEAT_RULES = {
  CAR:      { allowedTotal: [4, 5, 6, 7, 8, 9], maxPassengers: 8  },
  BIKE:     { allowedTotal: [2],        maxPassengers: 1  },
  AUTO:     { allowedTotal: [3],        maxPassengers: 2  },
  HATCHBACK:{ allowedTotal: [5],        maxPassengers: 4  },
  SEDAN:    { allowedTotal: [5],        maxPassengers: 4  },
  SUV:      { allowedTotal: [6, 7],     maxPassengers: 6  },
  VAN:      { allowedTotal: [7, 8, 9],  maxPassengers: 8  },
};

/**
 * Calculate how many passenger seats are available for a given vehicle.
 *
 * @param {string} vehicleType  - One of BIKE | AUTO | HATCHBACK | SEDAN | SUV | VAN
 * @param {number} totalSeats   - Total seating capacity declared by driver
 * @returns {{ availableSeats: number, maxPassengers: number }}
 * @throws {Error} if vehicleType is unknown or totalSeats is invalid for that type
 */
const calculateAvailableSeats = (vehicleType, totalSeats) => {
  const type = vehicleType?.toUpperCase();
  const rule = SEAT_RULES[type];

  if (!rule) {
    throw Object.assign(
      new Error(`Unknown vehicle type: ${vehicleType}`),
      { status: 400 }
    );
  }

  if (!rule.allowedTotal.includes(totalSeats)) {
    throw Object.assign(
      new Error(
        `${type} must have totalSeats of ${rule.allowedTotal.join(' or ')}. Got ${totalSeats}.`
      ),
      { status: 400 }
    );
  }

  // Driver always occupies one seat
  const availableSeats = totalSeats - 1;

  return { availableSeats, maxPassengers: rule.maxPassengers };
};

/**
 * Validate that a passenger's requested seat count doesn't exceed
 * what the ride allows.
 *
 * @param {number} passengersCount  - Seats the passenger wants to book
 * @param {number} availableSeats   - Current available seats on the ride
 * @param {string} vehicleType      - Vehicle type (for max cap check)
 * @throws {Error} with status 400 if validation fails
 */
const validatePassengerCount = (passengersCount, availableSeats, vehicleType) => {
  const type = vehicleType?.toUpperCase();
  const rule = SEAT_RULES[type];

  if (passengersCount < 1) {
    throw Object.assign(new Error('passengersCount must be at least 1'), { status: 400 });
  }

  if (rule && passengersCount > rule.maxPassengers) {
    throw Object.assign(
      new Error(`${type} allows max ${rule.maxPassengers} passenger(s) per booking`),
      { status: 400 }
    );
  }

  if (passengersCount > availableSeats) {
    throw Object.assign(
      new Error(`Only ${availableSeats} seat(s) available on this ride`),
      { status: 400 }
    );
  }
};

module.exports = { calculateAvailableSeats, validatePassengerCount, SEAT_RULES };
