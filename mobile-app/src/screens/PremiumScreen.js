/**
 * PlayNxt Premium Screen
 *
 * Subscription management and upgrade screen.
 * Displays available plans and handles purchases via RevenueCat.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePremium } from '../context/PremiumContext';

// Premium features to display
const PREMIUM_BENEFITS = [
  {
    icon: 'infinite-outline',
    title: 'Unlimited Rerolls',
    description: 'Get as many recommendations as you want',
  },
  {
    icon: 'time-outline',
    title: 'Smart History',
    description: 'Track your gaming decisions over time',
  },
  {
    icon: 'options-outline',
    title: 'Advanced Filters',
    description: 'Fine-tune recommendations to your taste',
  },
  {
    icon: 'sync-outline',
    title: 'Cross-Device Sync',
    description: 'Access your data anywhere',
  },
];

const PremiumScreen = () => {
  const navigation = useNavigation();
  const {
    isPremium,
    isLoading,
    packages,
    purchase,
    restorePurchases,
    manageSubscription,
    loadPackages,
    formatPrice,
    getSubscriptionPeriod,
    entitlement,
    getSubscriptionEndDate,
    willRenew,
  } = usePremium();

  const [selectedPackage, setSelectedPackage] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Load packages on mount
  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  // Auto-select lifetime package (or first available)
  useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      const lifetime = packages.find((p) => p.packageType === 'LIFETIME');
      setSelectedPackage(lifetime || packages[0]);
    }
  }, [packages, selectedPackage]);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setPurchasing(true);
    try {
      await purchase(selectedPackage);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      await restorePurchases();
    } finally {
      setPurchasing(false);
    }
  };

  const getPackageLabel = (pkg) => {
    const labels = {
      MONTHLY: 'Monthly',
      ANNUAL: 'Annual',
      LIFETIME: 'Lifetime',
      WEEKLY: 'Weekly',
      TWO_MONTH: '2 Months',
      THREE_MONTH: '3 Months',
      SIX_MONTH: '6 Months',
    };
    return labels[pkg.packageType] || pkg.identifier;
  };

  const getSavingsText = (pkg) => {
    if (pkg.packageType === 'ANNUAL') {
      return 'Save 33%';
    }
    if (pkg.packageType === 'LIFETIME') {
      return 'Best Value';
    }
    return null;
  };

  const formatExpirationDate = () => {
    const date = getSubscriptionEndDate();
    if (!date) return null;
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Premium user view
  if (isPremium) {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Premium</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.premiumActiveContent}
          >
            <View style={styles.premiumBadge}>
              <LinearGradient
                colors={['#fbbf24', '#f59e0b']}
                style={styles.premiumBadgeGradient}
              >
                <Ionicons name="star" size={48} color="#ffffff" />
              </LinearGradient>
            </View>

            <Text style={styles.premiumActiveTitle}>You're Premium!</Text>
            <Text style={styles.premiumActiveSubtitle}>
              Enjoy unlimited access to all features
            </Text>

            {entitlement && (
              <View style={styles.subscriptionInfo}>
                {formatExpirationDate() && (
                  <View style={styles.subscriptionRow}>
                    <Text style={styles.subscriptionLabel}>
                      {willRenew() ? 'Renews on' : 'Expires on'}
                    </Text>
                    <Text style={styles.subscriptionValue}>
                      {formatExpirationDate()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.benefitsList}>
              {PREMIUM_BENEFITS.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={styles.benefitIconContainer}>
                    <Ionicons name={benefit.icon} size={24} color="#10b981" />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDescription}>
                      {benefit.description}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.manageButton}
              onPress={manageSubscription}
            >
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Non-premium user view (upgrade screen)
  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Go Premium</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.upgradeContent}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['#e94560', '#ff6b6b']}
              style={styles.heroIconContainer}
            >
              <Ionicons name="star" size={40} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.heroTitle}>Unlock PlayNxt Premium</Text>
            <Text style={styles.heroSubtitle}>
              Get unlimited recommendations and powerful features
            </Text>
          </View>

          {/* Benefits List */}
          <View style={styles.benefitsList}>
            {PREMIUM_BENEFITS.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name={benefit.icon} size={24} color="#e94560" />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>
                    {benefit.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Package Selection */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e94560" />
              <Text style={styles.loadingText}>Loading plans...</Text>
            </View>
          ) : packages.length === 0 ? (
            <View style={styles.comingSoonContainer}>
              <View style={styles.comingSoonBadge}>
                <Ionicons name="rocket-outline" size={24} color="#e94560" />
                <Text style={styles.comingSoonText}>Coming Soon!</Text>
              </View>
              <Text style={styles.comingSoonDescription}>
                Premium features are on the way. Stay tuned!
              </Text>
            </View>
          ) : (
            <View style={styles.lifetimeContainer}>
              <View style={styles.lifetimeCard}>
                <View style={styles.lifetimeBadge}>
                  <Text style={styles.lifetimeBadgeText}>ONE-TIME PURCHASE</Text>
                </View>
                <Text style={styles.lifetimePrice}>
                  {selectedPackage ? formatPrice(selectedPackage.product) : ''}
                </Text>
                <Text style={styles.lifetimeDescription}>
                  Pay once, own forever. No subscriptions.
                </Text>
              </View>
            </View>
          )}

          {/* Purchase Button */}
          {packages.length > 0 && (
            <TouchableOpacity
              style={[
                styles.purchaseButton,
                (purchasing || !selectedPackage) && styles.purchaseButtonDisabled,
              ]}
              onPress={handlePurchase}
              disabled={purchasing || !selectedPackage}
            >
              <LinearGradient
                colors={
                  purchasing || !selectedPackage
                    ? ['#404040', '#505050']
                    : ['#e94560', '#ff6b6b']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.purchaseButtonGradient}
              >
                {purchasing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.purchaseButtonText}>
                    Unlock Premium - {selectedPackage ? formatPrice(selectedPackage.product) : ''}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Restore Purchases */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={purchasing}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Legal Text */}
          <Text style={styles.legalText}>
            One-time purchase. Payment will be charged to your App Store account.
            No subscription - yours forever.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  upgradeContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  premiumActiveContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  benefitsList: {
    marginBottom: 32,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  benefitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#808080',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#808080',
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  comingSoonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e94560',
    marginLeft: 8,
  },
  comingSoonDescription: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
  },
  lifetimeContainer: {
    marginBottom: 24,
  },
  lifetimeCard: {
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e94560',
  },
  lifetimeBadge: {
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  lifetimeBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  lifetimePrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  lifetimeDescription: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  purchaseButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#808080',
  },
  legalText: {
    fontSize: 12,
    color: '#606060',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Premium active styles
  premiumBadge: {
    marginTop: 40,
    marginBottom: 24,
  },
  premiumBadgeGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumActiveTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  premiumActiveSubtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 24,
  },
  subscriptionInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionLabel: {
    fontSize: 14,
    color: '#808080',
  },
  subscriptionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  manageButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 16,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default PremiumScreen;
