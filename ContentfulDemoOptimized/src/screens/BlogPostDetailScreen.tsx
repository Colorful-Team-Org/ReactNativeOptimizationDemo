import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollProvider, Analytics } from '@contentful/optimization-react-native';
import client from '../contentfulClient';
import RichTextRenderer from '../components/RichTextRenderer';

interface Props {
  route: {
    params: {
      postId: string;
      postTitle: string;
    };
  };
  navigation: any;
}

export default function BlogPostDetailScreen({ route, navigation }: Props) {
  const { postId, postTitle } = route.params;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setError(null);
        const entry = await client.getEntry(postId, { include: 10 });
        setPost(entry);
      } catch (err: any) {
        console.error('Failed to fetch blog post:', err);
        setError(err.message ?? 'Failed to load blog post');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#0070F3" />
        <Text style={styles.loadingText}>Loading {postTitle}…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <ScrollProvider>
      {/* Analytics wraps the blog post entry for viewport-based view tracking */}
      <Analytics entry={post}>
        <View style={styles.header}>
          <Text style={styles.postTitle}>{post?.fields?.title ?? postTitle}</Text>
          {post?.fields?.teaser ? (
            <Text style={styles.postTeaser}>{post.fields.teaser}</Text>
          ) : null}
        </View>

        <View style={styles.bodyContainer}>
          {post?.fields?.body ? (
            <RichTextRenderer document={post.fields.body} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No content for this post.</Text>
            </View>
          )}
        </View>
      </Analytics>
    </ScrollProvider>
  );
}

const styles = StyleSheet.create({
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 20,
  },
  postTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  postTeaser: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 22,
  },
  bodyContainer: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
