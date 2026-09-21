/**
 * Connect Steam Screen
 *
 * Free-tier Steam library sync: paste a profile URL (or Steam ID), and
 * PlayNxt stops recommending games you've already played. Optional and
 * removable — disconnect deletes the synced data entirely.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import { logEvent } from '../services/analyticsService';

type LibraryStatus = {
  connected: boolean;
  steam_id?: string | null;
  synced_at?: string | null;
  total_count: number;
  matched_count: number;
  played_count: number;
};

const ConnectSteamScreen = () => {
  const navigation = useNavigation();
  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getSteamLibraryStatus();
      setStatus(data);
    } catch (e) {
      // Status is a convenience read — the sync form still works without it
      setStatus({ connected: false, total_count: 0, matched_count: 0, played_count: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSync = useCallback(async () => {
    const input = profile.trim() || status?.steam_id;
    if (!input) {
      setError('Paste your Steam profile URL first');
      return;
    }
    setSyncing(true);
    setError(null);
    logEvent('steam_sync_started', { resync: !!status?.connected });
    try {
      const result = await api.syncSteamLibrary(input);
      logEvent('steam_sync_completed', {
        total: result.total_count,
        matched: result.matched_count,
      });
      setProfile('');
      await loadStatus();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not sync right now — check your connection and try again'
      );
      logEvent('steam_sync_failed', { status: e?.response?.status || 0 });
    } finally {
      setSyncing(false);
    }
  }, [profile, status, loadStatus]);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect Steam?',
      'This removes your Steam library data from PlayNxt. Games you played may show up in recommendations again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.disconnectSteamLibrary();
              logEvent('steam_sync_disconnected');
              setError(null);
              await loadStatus();
            } catch (e) {
              setError('Could not disconnect — try again');
            }
          },
        },
      ]
    );
  }, [loadStatus]);

  const syncedDate = status?.synced_at
    ? new Date(status.synced_at).toLocaleDateString()
    : null;

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Steam Library</Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator color="#f857a6" style={styles.loader} />
            ) : (
              <>
                {status?.connected ? (
                  <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                      <Ionicons name="checkmark-circle" size={22} color="#4ade80" />
                      <Text style={styles.statusTitle}>Steam connected</Text>
                    </View>
                    <Text style={styles.statusLine}>
                      {status.matched_count} of {status.total_count} games matched to our catalog
                    </Text>
                    <Text style={styles.statusLine}>
                      {status.played_count} games marked as played — we won't recommend those
                    </Text>
                    {syncedDate && (
                      <Text style={styles.statusMeta}>Last synced {syncedDate}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.introCard}>
                    <Text style={styles.introTitle}>
                      Stop seeing games you've already played
                    </Text>
                    <Text style={styles.introText}>
                      Connect your Steam profile and PlayNxt will skip games you have real
                      playtime in. No login needed — just your public profile.
                    </Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>
                  {status?.connected ? 'Re-sync or switch profile' : 'Steam profile URL or ID'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={profile}
                  onChangeText={setProfile}
                  placeholder={
                    status?.connected
                      ? 'Leave empty to re-sync the same profile'
                      : 'steamcommunity.com/id/yourname'
                  }
                  placeholderTextColor="#808090"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!syncing}
                />

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={styles.syncButton}
                  onPress={handleSync}
                  disabled={syncing}
                >
                  <LinearGradient
                    colors={['#e94560', '#ff6b6b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.syncGradient}
                  >
                    {syncing ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="sync-outline" size={20} color="#ffffff" />
                        <Text style={styles.syncButtonText}>
                          {status?.connected ? 'Re-sync library' : 'Sync my library'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {status?.connected && (
                  <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
                    <Text style={styles.disconnectText}>Disconnect Steam</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.helpCard}>
                  <Text style={styles.helpTitle}>Where do I find my profile URL?</Text>
                  <Text style={styles.helpText}>
                    In Steam, open your profile and copy the address bar — it looks like
                    steamcommunity.com/id/yourname. Your "Game details" privacy setting
                    must be Public for the sync to work.
                  </Text>
                  <Text style={styles.helpText}>
                    We only read your game list and playtime. Nothing is posted to Steam,
                    and disconnecting deletes the data.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loader: {
    marginTop: 60,
  },
  introCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#a0a0b0',
  },
  statusCard: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#d6d6e0',
    marginBottom: 4,
  },
  statusMeta: {
    fontSize: 12,
    color: '#808090',
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a0a0b0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#ff6b6b',
    marginBottom: 12,
  },
  syncButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  syncGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  disconnectButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  disconnectText: {
    fontSize: 14,
    color: '#ff6b6b',
  },
  helpCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#a0a0b0',
    marginBottom: 8,
  },
});

export default ConnectSteamScreen;
