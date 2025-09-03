import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useColors } from '@/theme';
import { apiClient } from '@/services/apiClient';
import { SRSDashboard as SRSDashboardType, SRSFolder } from '@/types';
import { AlertBanner } from '@/components/common/AlertBanner';
import { Button } from '@/components/common/Button';

interface SRSDashboardProps {
  onStartReview: () => void;
  onManageFolders: () => void;
}

export const SRSDashboard: React.FC<SRSDashboardProps> = ({ onStartReview, onManageFolders }) => {
  const colors = useColors();
  const [dashboard, setDashboard] = useState<SRSDashboardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setError(null);
      const response = await apiClient.srs.getDashboard();
      setDashboard(response.data);
    } catch (err) {
      console.error('Failed to load SRS dashboard:', err);
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  if (error || !dashboard) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AlertBanner
          type="error"
          message={error || 'Failed to load dashboard'}
          onClose={() => setError(null)}
        />
        <Button title="Retry" onPress={loadDashboard} variant="primary" />
      </View>
    );
  }

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return colors.success;
    if (streak >= 7) return colors.warning;
    return colors.primary;
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return colors.success;
    if (accuracy >= 75) return colors.warning;
    return colors.error;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>SRS Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your spaced repetition system overview
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.primary }]}>{dashboard.totalCards}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Cards</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.warning }]}>{dashboard.reviewsToday}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reviews Today</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.info }]}>{dashboard.newCardsToday}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>New Cards</Text>
        </View>
      </View>

      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Study Streak</Text>
          <Text style={[styles.metricValue, { color: getStreakColor(dashboard.streak) }]}>
            {dashboard.streak} days
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Accuracy</Text>
          <Text style={[styles.metricValue, { color: getAccuracyColor(dashboard.accuracy) }]}>
            {dashboard.accuracy}%
          </Text>
        </View>
      </View>

      {dashboard.reviewsToday > 0 && (
        <View style={[styles.actionCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
          <Text style={[styles.actionTitle, { color: colors.primary }]}>Ready to Review!</Text>
          <Text style={[styles.actionText, { color: colors.text }]}>
            You have {dashboard.reviewsToday} cards ready for review
          </Text>
          <Button
            title="Start Review"
            onPress={onStartReview}
            variant="primary"
            style={styles.actionButton}
          />
        </View>
      )}

      {dashboard.folders.length > 0 && (
        <View style={[styles.foldersContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.foldersHeader}>
            <Text style={[styles.foldersTitle, { color: colors.text }]}>Folders</Text>
            <TouchableOpacity onPress={onManageFolders}>
              <Text style={[styles.manageText, { color: colors.primary }]}>Manage</Text>
            </TouchableOpacity>
          </View>
          
          {dashboard.folders.slice(0, 3).map((folder) => (
            <View key={folder.id} style={[styles.folderItem, { borderBottomColor: colors.border }]}>
              <View style={styles.folderInfo}>
                <Text style={[styles.folderName, { color: colors.text }]}>{folder.name}</Text>
                <Text style={[styles.folderCardCount, { color: colors.textSecondary }]}>
                  {folder.cardCount} cards
                </Text>
              </View>
              {folder.color && (
                <View style={[styles.folderColor, { backgroundColor: folder.color }]} />
              )}
            </View>
          ))}
          
          {dashboard.folders.length > 3 && (
            <TouchableOpacity onPress={onManageFolders} style={styles.showMoreButton}>
              <Text style={[styles.showMoreText, { color: colors.primary }]}>
                +{dashboard.folders.length - 3} more folders
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {dashboard.upcomingReviews.length > 0 && (
        <View style={[styles.upcomingContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.upcomingTitle, { color: colors.text }]}>Upcoming Reviews</Text>
          {dashboard.upcomingReviews.slice(0, 5).map((card) => (
            <View key={card.id} style={[styles.upcomingItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.upcomingWord, { color: colors.text }]}>
                {card.vocab.lemma}
              </Text>
              <Text style={[styles.upcomingTime, { color: colors.textSecondary }]}>
                {new Date(card.nextReview).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionButton: {
    minWidth: 120,
  },
  foldersContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  foldersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  foldersTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  manageText: {
    fontSize: 16,
    fontWeight: '500',
  },
  folderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  folderCardCount: {
    fontSize: 14,
  },
  folderColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
  upcomingContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  upcomingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  upcomingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  upcomingWord: {
    fontSize: 16,
    fontWeight: '500',
  },
  upcomingTime: {
    fontSize: 14,
  },
  bottomSpacer: {
    height: 32,
  },
});