/**
 * PlayNxt What's New Screen
 *
 * Lists games added in the last 7 days. Notification deep-link target.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';

const PLATFORM_LABELS = {
  pc: 'PC',
  playstation: 'PS',
  xbox: 'Xbox',
  switch: 'Switch',
  mobile: 'Mobile',
};

const formatReleaseDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const WhatsNewScreen = () => {
  const navigation = useNavigation();
  const [games, setGames] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [recent, coming] = await Promise.all([
          api.getRecentGames(7, 20),
          api.getUpcomingGames(10).catch(() => []), // section is optional; never block the list
        ]);
        setGames(recent || []);
        setUpcoming(coming || []);
      } catch (e) {
        setError('Could not load new games. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('GameDetail', { gameId: item.game_id })}
      activeOpacity={0.7}
    >
      <View style={styles.rowMain}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.platforms}>
          {(item.platforms || []).map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
        </Text>
        {item.description_short ? (
          <Text style={styles.description} numberOfLines={2}>{item.description_short}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#808080" />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>What's New</Text>
          <View style={{ width: 28 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.empty}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={games}
            keyExtractor={(g) => g.game_id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyInList}>
                <Text style={styles.empty}>No new games this week — check back soon.</Text>
              </View>
            }
            ListFooterComponent={
              upcoming.length > 0 ? (
                <View style={styles.upcomingSection}>
                  <Text style={styles.upcomingHeader}>Coming Soon</Text>
                  {upcoming.map((item) => (
                    <TouchableOpacity
                      key={item.game_id}
                      style={styles.row}
                      onPress={() => navigation.navigate('GameDetail', { gameId: item.game_id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowMain}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.platforms}>
                          {(item.platforms || []).map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
                        </Text>
                        <Text style={styles.releaseDate}>
                          Releases {formatReleaseDate(item.release_date)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#808080" />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 8,
  },
  rowMain: { flex: 1, paddingRight: 8 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  platforms: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  description: { color: '#cbd5e1', fontSize: 13, marginTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyInList: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  empty: { color: '#9ca3af', textAlign: 'center', fontSize: 14 },
  upcomingSection: {
    marginTop: 24,
  },
  upcomingHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  releaseDate: {
    fontSize: 13,
    color: '#fbbf24',
    fontWeight: '600',
    marginTop: 2,
  },
});

export default WhatsNewScreen;
