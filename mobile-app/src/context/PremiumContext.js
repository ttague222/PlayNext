/**
 * PlayNxt Premium Context
 *
 * Manages premium subscription state and feature access.
 * MVP: All users are free tier. Premium features prepared for Phase 2.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const PremiumContext = createContext({});

export const usePremium = () => useContext(PremiumContext);

// Free tier limits
const FREE_TIER_LIMITS = {
  dailyRerolls: 5,
  historyDays: 0, // No history for free tier
};

// Premium features
const PREMIUM_FEATURES = {
  smartHistory: false,
  unlimitedRerolls: false,
  advancedFilters: false,
  crossDeviceSync: false,
};

export const PremiumProvider = ({ children }) => {
  const { user } = useAuth();

  // Premium state (MVP: everyone is free)
  const [isPremium, setIsPremium] = useState(false);
  const [premiumFeatures, setPremiumFeatures] = useState(PREMIUM_FEATURES);

  // Reroll tracking for free tier
  const [dailyRerollsUsed, setDailyRerollsUsed] = useState(0);
  const [rerollResetDate, setRerollResetDate] = useState(null);

  /**
   * Check if user can reroll (free tier limit or premium)
   */
  const canReroll = useCallback(() => {
    if (isPremium || premiumFeatures.unlimitedRerolls) {
      return true;
    }

    // Check if we need to reset daily count
    const today = new Date().toDateString();
    if (rerollResetDate !== today) {
      setDailyRerollsUsed(0);
      setRerollResetDate(today);
      return true;
    }

    return dailyRerollsUsed < FREE_TIER_LIMITS.dailyRerolls;
  }, [isPremium, premiumFeatures, dailyRerollsUsed, rerollResetDate]);

  /**
   * Record a reroll (for free tier tracking)
   */
  const recordReroll = useCallback(() => {
    if (!isPremium && !premiumFeatures.unlimitedRerolls) {
      setDailyRerollsUsed((prev) => prev + 1);
    }
  }, [isPremium, premiumFeatures]);

  /**
   * Get remaining rerolls for free tier
   */
  const getRemainingRerolls = useCallback(() => {
    if (isPremium || premiumFeatures.unlimitedRerolls) {
      return Infinity;
    }
    return Math.max(0, FREE_TIER_LIMITS.dailyRerolls - dailyRerollsUsed);
  }, [isPremium, premiumFeatures, dailyRerollsUsed]);

  /**
   * Check if a specific premium feature is available
   */
  const hasFeature = useCallback(
    (feature) => {
      if (isPremium) return true;
      return premiumFeatures[feature] || false;
    },
    [isPremium, premiumFeatures]
  );

  /**
   * Check if user should see premium upsell
   * Only show after they've had positive experiences
   */
  const shouldShowPremiumPrompt = useCallback(
    (totalAccepts, totalWorkedSignals) => {
      // Don't show to premium users
      if (isPremium) return false;

      // Only show after multiple accepts and at least one "worked" signal
      return totalAccepts >= 3 && totalWorkedSignals >= 1;
    },
    [isPremium]
  );

  /**
   * Upgrade to premium (placeholder for IAP integration)
   */
  const upgradeToPremium = useCallback(async () => {
    // TODO: Integrate with iOS/Android IAP
    // For now, just log the intent
    console.log('Premium upgrade requested');

    // In production, this would:
    // 1. Show IAP modal
    // 2. Process payment
    // 3. Update user record in Firebase
    // 4. Set isPremium = true

    return false;
  }, []);

  /**
   * Restore purchases (for IAP)
   */
  const restorePurchases = useCallback(async () => {
    // TODO: Implement IAP restore
    console.log('Restore purchases requested');
    return false;
  }, []);

  const value = {
    // State
    isPremium,
    premiumFeatures,
    dailyRerollsUsed,

    // Feature checks
    canReroll,
    getRemainingRerolls,
    hasFeature,
    shouldShowPremiumPrompt,

    // Actions
    recordReroll,
    upgradeToPremium,
    restorePurchases,

    // Constants
    FREE_TIER_LIMITS,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export default PremiumContext;
