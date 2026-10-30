import rideService from "../services/rideService";

/**
 * Debug utility to check what's happening with ride API
 * Run this in browser console:
 * 
 * import { debugRides } from '@/src/utils/debugRides';
 * await debugRides();
 */
export async function debugRides() {
  console.log("🔍 Debugging Rides API...\n");
  
  try {
    // 1. Check API response
    console.log("1️⃣ Calling API...");
    const result = await rideService.getAllRides();
    console.log("✅ API Result:", result);
    console.log("📊 Rides count:", result.data?.length || 0);
    
    if (result.data && result.data.length > 0) {
      console.log("🚨 rides still showing! First ride:", result.data[0]);
    } else {
      console.log("✅ API returned empty rides array");
    }
    
    // 2. Check localStorage cache
    const cached = localStorage.getItem('rides-cache');
    if (cached) {
      console.log("⚠️ Found cached rides in localStorage:", JSON.parse(cached));
    } else {
      console.log("✅ No localStorage cache found");
    }
    
    // 3. Check sessionStorage
    const sessionCached = sessionStorage.getItem('rides-cache');
    if (sessionCached) {
      console.log("⚠️ Found cached rides in sessionStorage:", JSON.parse(sessionCached));
    } else {
      console.log("✅ No sessionStorage cache found");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

/**
 * Clear all ride-related caches
 */
export function clearRideCaches() {
  localStorage.removeItem('rides-cache');
  localStorage.removeItem('rides');
  sessionStorage.removeItem('rides-cache');
  console.log("🧹 Cleared all ride caches!");
}

export default { debugRides, clearRideCaches };
