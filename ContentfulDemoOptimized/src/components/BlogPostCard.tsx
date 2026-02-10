import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BlogPostEntry {
  sys: { id: string; contentType: { sys: { id: string } } };
  fields: {
    title: string;
    slug: string;
    teaser?: string;
  };
}

interface BlogPostCardProps {
  post: BlogPostEntry;
  onPress: () => void;
}

export default function BlogPostCard({ post, onPress }: BlogPostCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardIcon}>
          <Text style={styles.cardIconText}>📝</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{post.fields.title}</Text>
          {post.fields.teaser ? (
            <Text style={styles.cardTeaser} numberOfLines={2}>
              {post.fields.teaser}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
});
