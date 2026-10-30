const PlatformConfig = require('../models/PlatformConfig');

const DEFAULT_PLATFORM_CONFIG = {
  pricing: {
    defaultFuelPrice: 103,
    platformFeePercent: 0.1,
  },
  penalties: {
    passengerCancellationPercent: 0.1,
    waitPenaltyPerMinute: 2,
    freeWaitMinutes: 5,
    autoCancelWaitMinutes: 15,
  },
};

const mergeConfig = (doc) => ({
  pricing: {
    ...DEFAULT_PLATFORM_CONFIG.pricing,
    ...(doc?.pricing || {}),
  },
  penalties: {
    ...DEFAULT_PLATFORM_CONFIG.penalties,
    ...(doc?.penalties || {}),
  },
});

const getPlatformConfig = async () => {
  const config = await PlatformConfig.findOne({ configKey: 'GLOBAL' }).lean();
  return mergeConfig(config);
};

const getOrCreatePlatformConfig = async () => {
  let config = await PlatformConfig.findOne({ configKey: 'GLOBAL' });
  if (!config) {
    config = await PlatformConfig.create({
      configKey: 'GLOBAL',
      ...DEFAULT_PLATFORM_CONFIG,
    });
  }
  return config;
};

const updatePlatformConfig = async ({ updates, updatedBy }) => {
  const config = await getOrCreatePlatformConfig();

  if (updates.pricing) {
    const currentPricing = config.pricing?.toObject ? config.pricing.toObject() : (config.pricing || {});
    config.pricing = {
      ...currentPricing,
      ...updates.pricing,
    };
  }

  if (updates.penalties) {
    const currentPenalties = config.penalties?.toObject ? config.penalties.toObject() : (config.penalties || {});
    config.penalties = {
      ...currentPenalties,
      ...updates.penalties,
    };
  }

  if (updatedBy) config.updatedBy = updatedBy;
  await config.save();
  return mergeConfig(config.toObject());
};

module.exports = {
  DEFAULT_PLATFORM_CONFIG,
  getPlatformConfig,
  getOrCreatePlatformConfig,
  updatePlatformConfig,
};
