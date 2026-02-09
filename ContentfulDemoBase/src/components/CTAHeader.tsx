import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import RichTextRenderer from './RichTextRenderer';

interface CTAHeaderProps {
  entry: {
    fields: {
      heading: string;
      body: any; // Rich Text document
      label: string;
    };
    sys: { id: string };
  };
}

/**
 * CTA header component displayed at the top of the home screen.
 * Renders a callToAction entry: heading, body (rich text), and a label button.
 */
export default function CTAHeader({ entry }: CTAHeaderProps) {
  const { heading, body, label } = entry.fields;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{heading}</Text>
      <View style={styles.bodyContainer}>
        <RichTextRenderer document={body} style={styles.bodyText} />
      </View>
      {label ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#0070F3',
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  bodyContainer: {
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 14,
    color: '#dbeafe',
    marginBottom: 0,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0070F3',
  },
});
