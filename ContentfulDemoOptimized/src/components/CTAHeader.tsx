import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RichTextRenderer from './RichTextRenderer';

interface CTAHeaderProps {
  entry: {
    fields: {
      heading?: string;
      body?: any; // Rich Text document
      label?: string;
      media?: {
        fields: {
          image?: {
            fields: {
              file: {
                url: string;
              };
            };
          };
        };
      };
    };
    sys: { id: string };
  };
}

/**
 * CTA header component displayed at the top of the home screen.
 * Renders a callToAction entry: image, heading, body (rich text), and a label button.
 *
 * The media field is a linked imageWithFocalPoint entry, which itself links to an Asset.
 * When fetched with sufficient include depth, the chain resolves to:
 *   entry.fields.media.fields.image.fields.file.url
 *
 * Note: personalization with a holdout means some users may see the baseline even
 * when they match a variant. The Personalization component handles this transparently.
 */
export default function CTAHeader({ entry }: CTAHeaderProps) {
  const { heading, body, label, media } = entry.fields;

  // Resolve the image URL through the imageWithFocalPoint -> Asset chain
  const imageUrl = media?.fields?.image?.fields?.file?.url;
  // Contentful URLs are protocol-relative; prefix with https:
  const fullImageUrl = imageUrl ? `https:${imageUrl}` : null;

  return (
    <View style={styles.container}>
      {fullImageUrl && (
        <Image
          source={{ uri: fullImageUrl }}
          style={styles.heroImage}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        {heading ? <Text style={styles.heading}>{heading}</Text> : null}
        {body ? (
          <View style={styles.bodyContainer}>
            <RichTextRenderer document={body} style={styles.bodyText} />
          </View>
        ) : null}
        {label ? (
          <TouchableOpacity style={styles.button} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0070F3',
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 200,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  bodyContainer: {
    marginBottom: 14,
  },
  bodyText: {
    fontSize: 14,
    color: '#dbeafe',
    marginBottom: 0,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0070F3',
  },
});
