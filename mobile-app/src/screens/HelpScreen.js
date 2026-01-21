/**
 * PlayNext Help/FAQ Screen
 *
 * Explains how the app works and answers common questions.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const FAQ_SECTIONS = [
  {
    title: 'How It Works',
    items: [
      {
        question: 'How does PlayNext recommend games?',
        answer: 'We match games based on your available time and current mood. Tell us how long you have and how you\'re feeling, and we\'ll suggest games that fit perfectly.',
      },
      {
        question: 'What do the mood options mean?',
        answer: 'Wind Down = relaxing, peaceful games. Casual = light, easygoing fun. Focused = immersive experiences. Intense = challenging, competitive games.',
      },
      {
        question: 'Why does time matter?',
        answer: 'Some games need 2 hours to really enjoy, while others are perfect for a quick 15-minute break. We match games to your available time so you\'re not left mid-session.',
      },
    ],
  },
  {
    title: 'Rerolls & Ads',
    items: [
      {
        question: 'How do rerolls work?',
        answer: 'If you don\'t like your recommendations, tap "Show different games" to reroll. You get 3 free rerolls each day. After that, you can watch a short ad to continue rerolling.',
      },
      {
        question: 'When do my free rerolls reset?',
        answer: 'Your 3 free rerolls reset at midnight each day. Premium users have unlimited rerolls with no ads.',
      },
      {
        question: 'Why are there ads?',
        answer: 'Ads help us keep PlayNext free while building our game database. Premium removes all ads and supports continued development.',
      },
    ],
  },
  {
    title: 'Game Library',
    items: [
      {
        question: 'How do I save games?',
        answer: 'Tap the bookmark icon on any game card to save it to your library. You can organize games into custom buckets like "Play Next", "Wishlist", or create your own.',
      },
      {
        question: 'What does "Already Played" do?',
        answer: 'Marking a game as already played helps us learn your taste. We\'ll swap it for a new recommendation and won\'t show it again in future sessions.',
      },
      {
        question: 'What does "This is it!" do?',
        answer: 'This tells us you\'ve found your game! We\'ll remember your choice to improve future recommendations.',
      },
    ],
  },
  {
    title: 'Filters & Options',
    items: [
      {
        question: 'What are the optional filters?',
        answer: 'You can filter by platform (PC, PlayStation, Xbox, Switch, Mobile), genres, play mode (solo or multiplayer), and discovery mode.',
      },
      {
        question: 'What\'s Discovery Mode?',
        answer: 'Familiar mode shows popular, well-known titles. Surprise Me surfaces hidden gems and lesser-known games you might love.',
      },
      {
        question: 'Do I have to use filters?',
        answer: 'No! All filters are optional. Leave them empty and we\'ll search across all games, platforms, and genres.',
      },
    ],
  },
];

const FAQItem = ({ question, answer }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#808090"
        />
      </View>
      {expanded && (
        <Text style={styles.faqAnswer}>{answer}</Text>
      )}
    </TouchableOpacity>
  );
};

const SUPPORT_EMAIL = 'support@watchlightinteractive.com';

const HelpScreen = () => {
  const navigation = useNavigation();

  const handleContactSupport = () => {
    const subject = encodeURIComponent('PlayNxt Support Request');
    const body = encodeURIComponent('Hi PlayNxt team,\n\n');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & FAQ</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>💡</Text>
            <Text style={styles.introText}>
              Everything you need to know about finding your next game
            </Text>
          </View>

          {/* FAQ Sections */}
          {FAQ_SECTIONS.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item, itemIndex) => (
                <FAQItem
                  key={itemIndex}
                  question={item.question}
                  answer={item.answer}
                />
              ))}
            </View>
          ))}

          {/* Quick Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Quick Tips</Text>
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>🎯</Text>
              <Text style={styles.tipText}>
                Be honest about your mood - it really helps!
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>📚</Text>
              <Text style={styles.tipText}>
                Save games to browse later when you have time
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipEmoji}>💎</Text>
              <Text style={styles.tipText}>
                Try "Surprise Me" to discover hidden gems
              </Text>
            </View>
          </View>

          {/* Contact */}
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Still have questions?</Text>
            <Text style={styles.contactText}>
              We'd love to hear from you! Reach out and we'll help you find your perfect game.
            </Text>
            <TouchableOpacity style={styles.contactButton} onPress={handleContactSupport}>
              <Text style={styles.contactButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
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
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  intro: {
    alignItems: 'center',
    marginBottom: 32,
  },
  introEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  introText: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f857a6',
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  faqItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#a0a0b0',
    marginTop: 12,
    lineHeight: 22,
  },
  tipsCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 16,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#c0c0d0',
    flex: 1,
  },
  contactCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#a0a0b0',
    textAlign: 'center',
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: 'rgba(248, 87, 166, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f857a6',
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f857a6',
  },
});

export default HelpScreen;
