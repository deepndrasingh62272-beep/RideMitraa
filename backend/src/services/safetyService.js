const Safety = require('../models/Safety');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { sendEmail } = require('./emailService');

class SafetyService {
  /**
   * Trigger SOS alert
   */
  async triggerSOS(rideId, passengerId) {
    try {
      // Fetch ride details
      const ride = await Ride.findById(rideId).populate('driverId passengerId');
      if (!ride) {
        throw new Error('Ride not found');
      }

      // Check if ride is ongoing (match Ride model enum: STARTED, BOOKING_OPEN, FULL)
      const validStatuses = ['STARTED', 'BOOKING_OPEN', 'FULL', 'ONGOING'];
      if (!validStatuses.includes(ride.status)) {
        throw new Error(`SOS can only be triggered during an active ride. Current status: ${ride.status}`);
      }

      // Check if safety record exists
      let safety = await Safety.findOne({ rideId });
      if (!safety) {
        safety = new Safety({
          rideId,
          passengerId,
          driverId: ride.driverId._id,
        });
      }

      // Trigger SOS
      safety.sosTriggered = true;
      safety.sosTriggeredAt = new Date();
      safety.sosStatus = 'ACTIVE';
      safety.liveLocationActive = true;

      // Fetch user's emergency contacts and add to safety record
      const user = await User.findById(passengerId).select('name phone email emergencyContacts');
      if (user && user.emergencyContacts && user.emergencyContacts.length > 0) {
        safety.emergencyContacts = user.emergencyContacts.map((contact) => ({
          ...contact,
          notified: true,
          notifiedAt: new Date(),
        }));
        
        // Send immediate SOS alert emails to all emergency contacts with email
        const locationLink = `https://www.google.com/maps?q=${ride.pickup?.coordinates?.[1] || 0},${ride.pickup?.coordinates?.[0] || 0}`;
        
        for (const contact of user.emergencyContacts) {
          if (contact.email) {
            await sendEmail(
              contact.email,
              '🚨 EMERGENCY SOS ALERT - Immediate Action Required',
              `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px;">
                    <h1 style="margin: 0; font-size: 24px;">🚨 SOS EMERGENCY ALERT</h1>
                  </div>
                  
                  <div style="padding: 20px; background-color: #fef2f2; border: 1px solid #fee2e2; margin-top: 20px; border-radius: 8px;">
                    <p style="font-size: 18px; color: #991b1b; margin-bottom: 10px;">
                      <strong>${user.name}</strong> has triggered an emergency SOS alert.
                    </p>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                      <p style="margin: 5px 0; color: #374151;"><strong>Passenger:</strong> ${user.name}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Ride ID:</strong> ${rideId}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Driver:</strong> ${ride.driverId?.name || 'Unknown'}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                      <a href="${locationLink}" 
                         style="display: inline-block; background-color: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                        📍 TRACK LIVE LOCATION
                      </a>
                    </div>
                    
                    <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0;">
                        <strong>⚠️ This is an automated emergency alert.</strong><br>
                        Please contact the user immediately. If you cannot reach them, call emergency services (100 for Police, 102 for Ambulance).
                      </p>
                    </div>
                  </div>
                  
                  <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
                    © Ride Sharing App - Emergency Alert System<br>
                    You will receive location updates every 5 minutes.
                  </p>
                </div>
              `
            );
            console.log(`[EMAIL] SOS alert sent to emergency contact: ${contact.email}`);
          }
        }
      }

      await safety.save();

      return {
        success: true,
        message: 'SOS triggered successfully',
        sosId: safety._id,
        rideId,
        emergencyContactsNotified: safety.emergencyContacts?.length || 0,
      };
    } catch (error) {
      console.error('SOS trigger error:', error);
      throw error;
    }
  }

  /**
   * Update live location during SOS
   */
  async updateLiveLocation(rideId, location) {
    try {
      const safety = await Safety.findOne({ rideId, sosTriggered: true });
      if (!safety) {
        throw new Error('No active SOS for this ride');
      }

      // Add location to history (keep last 100 locations)
      safety.locationHistory.push({
        lat: location.lat,
        lng: location.lng,
        timestamp: new Date(),
        accuracy: location.accuracy || null,
      });

      // Keep only last 100 locations
      if (safety.locationHistory.length > 100) {
        safety.locationHistory = safety.locationHistory.slice(-100);
      }

      await safety.save();

      // Send location update email every 5th update (to avoid spam) OR on first update
      const shouldSendEmail = safety.locationHistory.length === 1 || safety.locationHistory.length % 5 === 0;
      
      if (shouldSendEmail && safety.emergencyContacts && safety.emergencyContacts.length > 0) {
        const user = await User.findById(safety.passengerId);
        const locationLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
        
        for (const contact of safety.emergencyContacts) {
          if (contact.email && contact.notified) {
            await sendEmail(
              contact.email,
              `📍 LIVE LOCATION UPDATE - ${user?.name || 'User'}'s SOS Alert`,
              `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #f59e0b; color: white; padding: 15px; text-align: center; border-radius: 8px;">
                    <h1 style="margin: 0; font-size: 20px;">📍 LIVE LOCATION UPDATE</h1>
                  </div>
                  
                  <div style="padding: 20px; background-color: #fffbeb; border: 1px solid #fcd34d; margin-top: 15px; border-radius: 8px;">
                    <p style="font-size: 16px; color: #92400e; margin-bottom: 10px;">
                      <strong>${user?.name || 'User'}</strong>'s location has been updated.
                    </p>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                      <p style="margin: 5px 0; color: #374151;"><strong>Update #:</strong> ${safety.locationHistory.length}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Coordinates:</strong> ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                      <a href="${locationLink}" 
                         style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                        🗺️ VIEW ON MAP
                      </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 12px; margin-top: 15px;">
                      Updates are sent every 5 location points or immediately when available. 
                      <a href="${locationLink}" style="color: #f59e0b;">Track continuously</a>
                    </p>
                  </div>
                </div>
              `
            );
            console.log(`[EMAIL] Location update sent to: ${contact.email} (update #${safety.locationHistory.length})`);
          }
        }
      }

      return {
        success: true,
        message: 'Location updated',
        locationsCount: safety.locationHistory.length,
      };
    } catch (error) {
      console.error('Location update error:', error);
      throw error;
    }
  }

  /**
   * Cancel SOS alert
   */
  async cancelSOS(rideId) {
    try {
      const safety = await Safety.findOne({ rideId, sosTriggered: true });
      if (!safety) {
        throw new Error('No active SOS for this ride');
      }

      safety.sosTriggered = false;
      safety.sosStatus = 'CANCELLED';
      safety.liveLocationActive = false;

      await safety.save();

      return {
        success: true,
        message: 'SOS cancelled',
      };
    } catch (error) {
      console.error('SOS cancel error:', error);
      throw error;
    }
  }

  /**
   * Alert emergency services
   */
  async alertEmergencyServices(rideId, serviceType, location) {
    try {
      const safety = await Safety.findOne({ rideId });
      if (!safety) {
        throw new Error('Safety record not found');
      }

      const timestamp = new Date();

      if (serviceType === 'police') {
        safety.policeAlerted = true;
        safety.policeAlertedAt = timestamp;
      } else if (serviceType === 'ambulance') {
        safety.ambulanceAlerted = true;
        safety.ambulanceAlertedAt = timestamp;
      }

      await safety.save();

      // In production, integrate with actual emergency service APIs
      console.log(`[EMERGENCY] ${serviceType.toUpperCase()} alerted for ride ${rideId}`);
      console.log(`Location: ${location.lat}, ${location.lng}`);

      return {
        success: true,
        message: `${serviceType} has been alerted`,
        alertedAt: timestamp,
      };
    } catch (error) {
      console.error('Emergency alert error:', error);
      throw error;
    }
  }

  /**
   * Notify emergency contacts
   */
  async notifyEmergencyContacts(rideId, passengerId) {
    try {
      const safety = await Safety.findOne({ rideId });
      if (!safety) {
        throw new Error('Safety record not found');
      }

      // Fetch user's emergency contacts
      const user = await User.findById(passengerId);
      if (!user || !user.emergencyContacts) {
        return {
          success: true,
          message: 'No emergency contacts to notify',
          notifiedCount: 0,
        };
      }

      const timestamp = new Date();
      let notifiedCount = 0;

      // Update emergency contacts in safety record
      safety.emergencyContacts = user.emergencyContacts.map((contact) => ({
        ...contact,
        notified: true,
        notifiedAt: timestamp,
      }));

      notifiedCount = safety.emergencyContacts.length;
      await safety.save();

      // Send email notifications to emergency contacts with location link
      if (user.emergencyContacts && user.emergencyContacts.length > 0) {
        const locationLink = `https://www.google.com/maps?q=${safety.locationHistory?.[0]?.lat || 0},${safety.locationHistory?.[0]?.lng || 0}`;
        
        for (const contact of user.emergencyContacts) {
          if (contact.email) {
            await sendEmail(
              contact.email,
              '🚨 EMERGENCY SOS ALERT - Your Contact Needs Help',
              `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px;">
                    <h1 style="margin: 0; font-size: 24px;">🚨 SOS EMERGENCY ALERT</h1>
                  </div>
                  
                  <div style="padding: 20px; background-color: #fef2f2; border: 1px solid #fee2e2; margin-top: 20px; border-radius: 8px;">
                    <p style="font-size: 18px; color: #991b1b; margin-bottom: 10px;">
                      <strong>${user.name}</strong> has triggered an SOS emergency alert.
                    </p>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                      <p style="margin: 5px 0; color: #374151;"><strong>Ride ID:</strong> ${rideId}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                      <p style="margin: 5px 0; color: #374151;"><strong>Status:</strong> ACTIVE EMERGENCY</p>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                      <a href="${locationLink}" 
                         style="display: inline-block; background-color: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                        📍 TRACK LIVE LOCATION
                      </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                      This is an automated emergency alert. Please contact the user immediately or call emergency services if needed.
                    </p>
                  </div>
                  
                  <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
                    © Ride Sharing App - Emergency Alert System
                  </p>
                </div>
              `
            );
            console.log(`[EMAIL] SOS alert sent to emergency contact: ${contact.email}`);
          }
        }
      }

      console.log(`[EMERGENCY] Notified ${notifiedCount} emergency contacts for ride ${rideId}`);

      return {
        success: true,
        message: `${notifiedCount} emergency contact(s) notified`,
        notifiedCount,
      };
    } catch (error) {
      console.error('Emergency contact notification error:', error);
      throw error;
    }
  }

  /**
   * Get safety record for a ride
   */
  async getSafetyRecord(rideId) {
    try {
      const safety = await Safety.findOne({ rideId })
        .populate('passengerId', 'name phone avatar')
        .populate('driverId', 'name phone avatar');

      if (!safety) {
        return null;
      }

      return safety;
    } catch (error) {
      console.error('Get safety record error:', error);
      throw error;
    }
  }

  /**
   * Resolve SOS incident
   */
  async resolveSOS(rideId, resolutionNotes) {
    try {
      const safety = await Safety.findOne({ rideId });
      if (!safety) {
        throw new Error('Safety record not found');
      }

      safety.sosStatus = 'RESOLVED';
      safety.resolvedAt = new Date();
      safety.resolutionNotes = resolutionNotes;
      safety.liveLocationActive = false;

      await safety.save();

      return {
        success: true,
        message: 'SOS incident resolved',
      };
    } catch (error) {
      console.error('SOS resolve error:', error);
      throw error;
    }
  }

  /**
   * Get safety history for a user
   */
  async getSafetyHistory(userId, limit = 10) {
    try {
      const safetyRecords = await Safety.find({
        $or: [{ passengerId: userId }, { driverId: userId }],
        sosTriggered: true,
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('rideId', 'pickup drop')
        .populate('passengerId', 'name')
        .populate('driverId', 'name');

      return safetyRecords;
    } catch (error) {
      console.error('Get safety history error:', error);
      throw error;
    }
  }

  /**
   * Get active SOS incidents (admin)
   */
  async getActiveSOS() {
    try {
      const activeSOS = await Safety.find({
        sosTriggered: true,
        sosStatus: 'ACTIVE',
      })
        .populate('rideId', 'pickup drop status')
        .populate('passengerId', 'name phone')
        .populate('driverId', 'name phone')
        .sort({ sosTriggeredAt: -1 });

      return activeSOS;
    } catch (error) {
      console.error('Get active SOS error:', error);
      throw error;
    }
  }
}

module.exports = new SafetyService();
