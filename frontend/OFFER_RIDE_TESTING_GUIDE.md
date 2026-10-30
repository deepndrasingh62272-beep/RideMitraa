# Offer Ride Testing Guide

## Fixed Issues

### 1. ✅ Location Selection & Distance Calculation
- **Problem**: Pickup/drop locations weren't being geocoded, distance wasn't calculating, fare wasn't being calculated
- **Solution**: 
  - Step1Location now calls `geocodeAddress()` API to get real coordinates
  - Automatically calculates distance using `rideService.estimateFare()` 
  - Shows real distance in km on the map preview
  - Coordinates are stored in form state for submission

### 2. ✅ Bike Toggle Issue
- **Problem**: When selecting bike, it was showing 3 seats instead of 2
- **Solution**:
  - Fixed `Step4Seats` to correctly set `totalSeats = 2` for bikes
  - Added useEffect to reset seats when vehicle type changes
  - Max offer seats for bike = 1 (2 total - 1 driver)
  - Max offer seats for car = 4 (5 total - 1 driver)

### 3. ✅ Mock Data Removed
- **Problem**: Fare calculation was using hardcoded 42km distance
- **Solution**:
  - Step5Pricing now fetches real distance from API
  - Uses `rideService.estimateFare()` to get actual fare
  - Displays loading state while calculating
  - Shows error if calculation fails

### 4. ✅ Fare Calculation
- **Problem**: Fare wasn't being calculated from API
- **Solution**:
  - Step5Pricing calls API with real coordinates
  - Calculates per-seat fare based on total distance
  - Updates when vehicle type or seats change
  - Sends farePerSeat to backend on submission

---

## Test Cases

### Test Route 1: Sitapur UP to Lucknow

**Bike Rides (5 rides)**

1. **Bike Ride 1**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Hero Honda CB Shine
   - Model: 2023
   - Registration: UP14AB1234
   - Fuel: Petrol
   - Mileage: 60
   - Seats: 1 (max for bike)
   - Date: 2026-04-27
   - Time: 08:00
   - Expected: ~60km, ₹300-400/seat

2. **Bike Ride 2**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Bajaj Pulsar
   - Model: 2022
   - Registration: UP14CD5678
   - Fuel: Petrol
   - Mileage: 55
   - Seats: 1
   - Date: 2026-04-27
   - Time: 10:00

3. **Bike Ride 3**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: TVS Apache
   - Model: 2023
   - Registration: UP14EF9012
   - Fuel: Petrol
   - Mileage: 65
   - Seats: 1
   - Date: 2026-04-27
   - Time: 12:00

4. **Bike Ride 4**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Royal Enfield Classic
   - Model: 2023
   - Registration: UP14GH3456
   - Fuel: Petrol
   - Mileage: 40
   - Seats: 1
   - Date: 2026-04-27
   - Time: 14:00

5. **Bike Ride 5**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Yamaha FZ
   - Model: 2022
   - Registration: UP14IJ7890
   - Fuel: Petrol
   - Mileage: 50
   - Seats: 1
   - Date: 2026-04-27
   - Time: 16:00

**Car Rides (5 rides)**

6. **Car Ride 1**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Tata Nexon
   - Model: 2023 EV Max
   - Registration: UP14KL1111
   - Fuel: EV
   - Mileage: 20
   - Seats: 4 (max for car)
   - Date: 2026-04-27
   - Time: 08:30
   - Expected: ~60km, ₹150-200/seat

7. **Car Ride 2**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Maruti Swift
   - Model: 2023
   - Registration: UP14MN2222
   - Fuel: Petrol
   - Mileage: 23
   - Seats: 3
   - Date: 2026-04-27
   - Time: 09:30

8. **Car Ride 3**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Hyundai i20
   - Model: 2022
   - Registration: UP14OP3333
   - Fuel: Petrol
   - Mileage: 18
   - Seats: 4
   - Date: 2026-04-27
   - Time: 11:00

9. **Car Ride 4**
   - Pickup: Sitapur, Uttar Pradesh
   - Drop: Lucknow, Uttar Pradesh
   - Vehicle: Honda City
   - Model: 2023
   - Registration: UP14QR4444
   - Fuel: Petrol
   - Mileage: 16
   - Seats: 3
   - Date: 2026-04-27
   - Time: 13:00

10. **Car Ride 5**
    - Pickup: Sitapur, Uttar Pradesh
    - Drop: Lucknow, Uttar Pradesh
    - Vehicle: Mahindra XUV300
    - Model: 2023
    - Registration: UP14ST5555
    - Fuel: Diesel
    - Mileage: 19
    - Seats: 4
    - Date: 2026-04-27
    - Time: 15:00

---

### Test Route 2: Delhi to Pune

**Bike Rides (5 rides)**

11. **Bike Ride 6**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Hero Honda CB Shine
    - Model: 2023
    - Registration: DL01AB6666
    - Fuel: Petrol
    - Mileage: 60
    - Seats: 1
    - Date: 2026-04-28
    - Time: 06:00
    - Expected: ~1400km, ₹7000-8000/seat

12. **Bike Ride 7**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Bajaj Pulsar
    - Model: 2022
    - Registration: DL01CD7777
    - Fuel: Petrol
    - Mileage: 55
    - Seats: 1
    - Date: 2026-04-28
    - Time: 07:00

13. **Bike Ride 8**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: TVS Apache
    - Model: 2023
    - Registration: DL01EF8888
    - Fuel: Petrol
    - Mileage: 65
    - Seats: 1
    - Date: 2026-04-28
    - Time: 08:00

14. **Bike Ride 9**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Royal Enfield Classic
    - Model: 2023
    - Registration: DL01GH9999
    - Fuel: Petrol
    - Mileage: 40
    - Seats: 1
    - Date: 2026-04-28
    - Time: 09:00

15. **Bike Ride 10**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Yamaha FZ
    - Model: 2022
    - Registration: DL01IJ0000
    - Fuel: Petrol
    - Mileage: 50
    - Seats: 1
    - Date: 2026-04-28
    - Time: 10:00

**Car Rides (5 rides)**

16. **Car Ride 6**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Tata Nexon
    - Model: 2023 EV Max
    - Registration: DL01KL1111
    - Fuel: EV
    - Mileage: 20
    - Seats: 4
    - Date: 2026-04-28
    - Time: 06:30

17. **Car Ride 7**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Maruti Swift
    - Model: 2023
    - Registration: DL01MN2222
    - Fuel: Petrol
    - Mileage: 23
    - Seats: 3
    - Date: 2026-04-28
    - Time: 07:30

18. **Car Ride 8**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Hyundai i20
    - Model: 2022
    - Registration: DL01OP3333
    - Fuel: Petrol
    - Mileage: 18
    - Seats: 4
    - Date: 2026-04-28
    - Time: 08:30

19. **Car Ride 9**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Honda City
    - Model: 2023
    - Registration: DL01QR4444
    - Fuel: Petrol
    - Mileage: 16
    - Seats: 3
    - Date: 2026-04-28
    - Time: 09:30

20. **Car Ride 10**
    - Pickup: Delhi
    - Drop: Pune, Maharashtra
    - Vehicle: Mahindra XUV300
    - Model: 2023
    - Registration: DL01ST5555
    - Fuel: Diesel
    - Mileage: 19
    - Seats: 4
    - Date: 2026-04-28
    - Time: 10:30

---

## Verification Checklist

### Step 1: Location Selection
- [ ] Enter pickup location (e.g., "Sitapur, Uttar Pradesh")
- [ ] Enter drop location (e.g., "Lucknow, Uttar Pradesh")
- [ ] Verify distance appears in map preview (should show real km)
- [ ] Verify "Route Ready" status shows with green indicator
- [ ] Test swap button - locations should reverse
- [ ] Verify coordinates are being stored (check browser console)

### Step 2: Date & Time
- [ ] Select future date
- [ ] Select time
- [ ] Verify both are required to proceed

### Step 3: Vehicle Details
- [ ] Enter vehicle name
- [ ] Enter vehicle model
- [ ] Enter registration number (uppercase)
- [ ] Select fuel type
- [ ] Enter mileage
- [ ] **For Bike**: Verify only 2 seats max available
- [ ] **For Car**: Verify 5 seats max available

### Step 4: Seats
- [ ] **For Bike**: Max seats should be 1 (2 total - 1 driver)
- [ ] **For Car**: Max seats should be 4 (5 total - 1 driver)
- [ ] Verify slider works correctly
- [ ] Verify +/- buttons work
- [ ] Verify seat count updates summary

### Step 5: Pricing
- [ ] Verify distance is calculated from API (not hardcoded 42km)
- [ ] Verify fare per seat is calculated
- [ ] Verify fare changes when vehicle type changes
- [ ] Verify fare changes when seats change
- [ ] **For Bike**: Fare should be lower than car for same distance
- [ ] **For Car**: Fare should be higher than bike for same distance
- [ ] Verify loading state appears while calculating

### Submission
- [ ] Click "Publish Ride"
- [ ] Verify success toast appears
- [ ] Verify redirected to dashboard
- [ ] Check backend logs for ride creation
- [ ] Verify ride appears in published rides list

---

## Expected Fare Ranges

### Sitapur to Lucknow (~60km)
- **Bike**: ₹300-400 per seat
- **Car**: ₹150-200 per seat

### Delhi to Pune (~1400km)
- **Bike**: ₹7000-8000 per seat
- **Car**: ₹3500-4500 per seat

---

## Troubleshooting

### Distance not showing
- Check browser console for geocoding errors
- Verify location names are valid (city names, landmarks)
- Check if mapService is working

### Fare not calculating
- Verify coordinates are being set in Step 1
- Check if rideService.estimateFare() is being called
- Check backend fare calculation endpoint

### Bike showing 3 seats
- Clear browser cache
- Verify Step4Seats component has been updated
- Check if vehicleType is being passed correctly

### Mock data still showing
- Verify Step5Pricing is using API data, not hardcoded values
- Check if distance variable is being updated from API
- Verify farePerSeat is calculated from API response

---

## API Endpoints Used

1. **Geocoding**: `mapService.geocodeAddress(address)`
   - Converts address to coordinates [lng, lat]

2. **Fare Estimation**: `rideService.estimateFare(lat, lng, lat, lng, vehicleType)`
   - Returns: { distanceKm, totalFare, fare }

3. **Publish Ride**: `rideService.publishRide(rideData)`
   - Submits ride with all details to backend

---

## Notes

- All test rides use future dates (2026-04-27, 2026-04-28)
- Registration numbers follow Indian format: StateCode + 2 letters + 4 digits
- Mileage values are realistic for each vehicle type
- Seats are set to maximum available for each vehicle type
- Fare calculation is based on distance and vehicle type
