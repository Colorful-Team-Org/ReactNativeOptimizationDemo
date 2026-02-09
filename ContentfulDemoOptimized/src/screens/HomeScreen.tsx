import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Personalization, Analytics } from '@contentful/optimization-react-native';
import client, { CTA_ENTRY_ID } from '../contentfulClient';
import CTAHeader from '../components/CTAHeader';

interface BlogPostEntry {
  sys: { id: string; contentType: { sys: { id: string } } };
  fields: {
    title: string;
    slug: string;
    teaser?: string;
  };
}

interface Props {
  navigation: any;
}

export default function HomeScreen({ navigation }: Props) {
  const [cta, setCta] = useState<any>(null);
  const [posts, setPosts] = useState<BlogPostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);

      // Fetch CTA with include:10 so all variant data is loaded for personalization
      const [ctaResponse, postsResponse] = await Promise.all([
        client.getEntry(CTA_ENTRY_ID, { include: 10 }),
        client.getEntries({
          content_type: 'blogPost',
          order: ['-fields.title'],
          include: 2,
        }),
      ]);

      setCta(ctaResponse);
      setPosts(postsResponse.items as unknown as BlogPostEntry[]);
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.message ?? 'Failed to load content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#0070F3" />
        <Text style={styles.loadingText}>Loading content…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.sys.id}
        ListHeaderComponent={
          <>
            {/* Personalization wraps the CTA to resolve the correct variant */}
            {cta && (
              <Personalization baselineEntry={cta}>
                {(resolvedEntry: any) => <CTAHeader entry={resolvedEntry} />}
              </Personalization>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Blog Posts</Text>
              <Text style={styles.sectionSubtitle}>
                {posts.length} post{posts.length !== 1 ? 's' : ''} available
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          // Analytics wraps each blog post entry for view tracking
          <Analytics entry={item as any}>
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('BlogPostDetail', {
                  postId: item.sys.id,
                  postTitle: item.fields.title,
                })
              }
            >
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <Text style={styles.cardIconText}>📝</Text>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.fields.title}</Text>
                  {item.fields.teaser ? (
                    <Text style={styles.cardTeaser} numberOfLines={2}>
                      {item.fields.teaser}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </Analytics>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0070F3" />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#0070F3',
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardIconText: {
    fontSize: 20,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  cardTeaser: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 28,
    color: '#d1d5db',
    fontWeight: '300',
  },
  separator: {
    height: 10,
  },
});
