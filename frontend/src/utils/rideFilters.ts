import { Ride } from "@/types/ride";

interface FilterOptions {
  currentTime?: Date;
}

/**
 * Filters rides to show only active ones based on:
 * 1. Must have available seats (not fully booked)
 * 2. Ride hasn't started yet (current time < ride start time)
 * 3. Departure time is in the future
 * 
 * @param rides - Array of rides to filter
 * @param options - Optional filter options
 * @returns Array of active rides only
 */
export function filterActiveRides(
  rides: Ride[],
  options: FilterOptions = {}
): Ride[] {
  const now = options.currentTime || new Date();

  return rides.filter((ride) => {
    // Check 1: Must have available seats
    const hasAvailableSeats = ride.seats > 0;
    if (!hasAvailableSeats) {
      return false;
    }

    // Check 2 & 3: Ride must not have started yet (future departure)
    // Parse ride date and time
    const rideDateTime = parseRideDateTime(ride.date, ride.time);
    
    // If we can't parse the date/time, hide the ride to be safe
    if (!rideDateTime) {
      return false;
    }

    const hasNotStarted = rideDateTime > now;
    if (!hasNotStarted) {
      return false;
    }

    // All conditions met - ride is active
    return true;
  });
}

/**
 * Parse ride date and time strings into a Date object
 * Handles multiple formats and edge cases
 */
function parseRideDateTime(dateStr: string | undefined, timeStr: string): Date | null {
  try {
    // If no date provided, use today
    if (!dateStr || dateStr === "Today") {
      const today = new Date();
      dateStr = today.toISOString().split("T")[0];
    }

    // Handle various date formats
    // Expected: "2024-01-15" or "15-01-2024" or "Jan 15, 2024"
    let parsedDate: Date;

    if (dateStr.includes("-")) {
      // ISO format or dd-MM-yyyy
      const parts = dateStr.split("-");
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        parsedDate = new Date(`${dateStr}T${timeStr}`);
      } else {
        // DD-MM-YYYY - convert to YYYY-MM-DD
        parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${timeStr}`);
      }
    } else {
      // Try direct parsing with time
      parsedDate = new Date(`${dateStr} ${timeStr}`);
    }

    // Check if valid date
    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error("Error parsing ride date/time:", { dateStr, timeStr, error });
    return null;
  }
}

/**
 * Check if a specific ride is active and bookable
 * Useful for individual ride validation
 */
export function isRideActive(ride: Ride, currentTime?: Date): boolean {
  const now = currentTime || new Date();

  // Must have available seats
  if (ride.seats <= 0) {
    return false;
  }

  // Must be in the future
  const rideDateTime = parseRideDateTime(ride.date, ride.time);
  if (!rideDateTime) {
    return false;
  }

  return rideDateTime > now;
}

/**
 * Get a human-readable status for why a ride is not active
 * Useful for debugging or UI messages
 */
export function getRideInactiveReason(ride: Ride, currentTime?: Date): string | null {
  const now = currentTime || new Date();

  // Check seats
  if (ride.seats <= 0) {
    return "All seats booked";
  }

  // Check time
  const rideDateTime = parseRideDateTime(ride.date, ride.time);
  if (!rideDateTime) {
    return "Invalid date/time";
  }

  if (rideDateTime <= now) {
    return "Ride has already departed";
  }

  // Ride is active
  return null;
}

/**
 * Sort rides by departure time (earliest first)
 * Active rides first, then by time
 */
export function sortRidesByTime(rides: Ride[]): Ride[] {
  return [...rides].sort((a, b) => {
    const dateA = parseRideDateTime(a.date, a.time);
    const dateB = parseRideDateTime(b.date, b.time);

    // If can't parse, put at the end
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Complete ride filtering pipeline:
 * 1. Filter active rides
 * 2. Sort by departure time
 */
export function getActiveAndSortedRides(
  rides: Ride[],
  options?: FilterOptions
): Ride[] {
  const activeRides = filterActiveRides(rides, options);
  return sortRidesByTime(activeRides);
}
