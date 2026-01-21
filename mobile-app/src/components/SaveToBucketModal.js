/**
 * SaveToBucketModal Component
 *
 * Modal for selecting which bucket to save a game to.
 * Works for both signed-in users (server sync) and anonymous users (local storage).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSavedGames, BUCKET_TYPES, BUCKET_CONFIG } from '../context/SavedGamesContext';
import { useNavigation } from '@react-navigation/native';

const BUCKET_ORDER = [
  BUCKET_TYPES.BACKLOG,
  BUCKET_TYPES.PLAYING,
  BUCKET_TYPES.PLAYED,
  BUCKET_TYPES.NOT_FOR_ME,
];

const SaveToBucketModal = ({ visible, game, onClose, onSaved }) => {
  const navigation = useNavigation();
  const { addGameToBucket, getGameBucket, isUsingLocalStorage } = useSavedGames();

  const [currentBucket, setCurrentBucket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingBucket, setCheckingBucket] = useState(true);
  const isProcessingRef = useRef(false);

  // Check which bucket the game is currently in
  useEffect(() => {
    const checkCurrentBucket = async () => {
      if (!visible || !game) {
        setCurrentBucket(null);
        setCheckingBucket(false);
        return;
      }

      setCheckingBucket(true);
      try {
        const bucket = await getGameBucket(game.game_id);
        setCurrentBucket(bucket);
      } catch (err) {
        setCurrentBucket(null);
      } finally {
        setCheckingBucket(false);
      }
    };

    checkCurrentBucket();
  }, [visible, game, getGameBucket]);

  const handleSelectBucket = async (bucketType) => {
    // Use ref to prevent race condition on rapid taps
    if (!game || loading || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setLoading(true);
    try {
      // Pass full game data for offline storage (local users)
      await addGameToBucket(bucketType, game.game_id, game.title, null, game);
      setCurrentBucket(bucketType);
      onSaved?.(bucketType);
      // Small delay so user sees the selection
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err) {
      // Silent fail - bucket selection just won't update
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleSignIn = () => {
    onClose();
    navigation.navigate('Profile');
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} style={styles.modalContent}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Save Game</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#808080" />
              </TouchableOpacity>
            </View>

            {/* Game info */}
            <View style={styles.gameInfo}>
              <Text style={styles.gameTitle} numberOfLines={1}>
                {game.title}
              </Text>
            </View>

            {checkingBucket ? (
              /* Loading state */
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#f857a6" size="large" />
              </View>
            ) : (
              /* Bucket options */
              <View style={styles.buckets}>
                {BUCKET_ORDER.map((bucketType) => {
                  const config = BUCKET_CONFIG[bucketType];
                  const isSelected = currentBucket === bucketType;

                  return (
                    <TouchableOpacity
                      key={bucketType}
                      style={[
                        styles.bucketOption,
                        isSelected && styles.bucketSelected,
                        isSelected && { borderColor: config.color },
                      ]}
                      onPress={() => handleSelectBucket(bucketType)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={[`${config.color}30`, `${config.color}10`]}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <View style={[styles.bucketIcon, { backgroundColor: `${config.color}30` }]}>
                        <Ionicons name={config.icon} size={20} color={config.color} />
                      </View>
                      <View style={styles.bucketInfo}>
                        <Text
                          style={[
                            styles.bucketName,
                            isSelected && { color: config.color },
                          ]}
                        >
                          {config.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkmark, { backgroundColor: config.color }]}>
                          <Ionicons name="checkmark" size={14} color="#ffffff" />
                        </View>
                      )}
                      {loading && isSelected && (
                        <ActivityIndicator color={config.color} size="small" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Current status hint */}
            {currentBucket && (
              <Text style={styles.statusHint}>
                Currently in: {BUCKET_CONFIG[currentBucket]?.name}
              </Text>
            )}

            {/* Sync prompt for anonymous users */}
            {isUsingLocalStorage && (
              <TouchableOpacity
                style={styles.syncPrompt}
                onPress={handleSignIn}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={16} color="#7c3aed" />
                <Text style={styles.syncPromptText}>
                  Sign in to sync across devices
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#7c3aed" />
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  gameInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  buckets: {
    gap: 10,
  },
  bucketOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  bucketSelected: {
    borderWidth: 2,
  },
  bucketIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bucketInfo: {
    flex: 1,
  },
  bucketName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  statusHint: {
    fontSize: 12,
    color: '#606080',
    textAlign: 'center',
    marginTop: 16,
  },
  syncPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 16,
    gap: 6,
  },
  syncPromptText: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '500',
  },
});

export default SaveToBucketModal;
