import React from 'react';
import { Text, StyleSheet } from 'react-native';

// Contentful Rich Text node types
interface RichTextNode {
  nodeType: string;
  value?: string;
  marks?: Array<{ type: string }>;
  content?: RichTextNode[];
  data?: Record<string, unknown>;
}

interface RichTextDocument {
  nodeType: 'document';
  content: RichTextNode[];
  data: Record<string, unknown>;
}

interface RichTextRendererProps {
  document: RichTextDocument | undefined | null;
  style?: object;
}

/**
 * Extracts plain text from a rich text node tree, recursively.
 */
function extractText(node: RichTextNode): string {
  if (node.nodeType === 'text') {
    return node.value ?? '';
  }
  if (node.content) {
    return node.content.map(extractText).join('');
  }
  return '';
}

/**
 * Renders inline content (text nodes with marks, embedded entries as fallback text).
 */
function renderInlineContent(nodes: RichTextNode[]): React.ReactNode[] {
  return nodes.map((node, index) => {
    if (node.nodeType === 'text') {
      const isBold = node.marks?.some((m) => m.type === 'bold');
      const isItalic = node.marks?.some((m) => m.type === 'italic');
      const isUnderline = node.marks?.some((m) => m.type === 'underline');
      return (
        <Text
          key={index}
          style={[
            isBold && styles.bold,
            isItalic && styles.italic,
            isUnderline && styles.underline,
          ]}
        >
          {node.value}
        </Text>
      );
    }
    // For embedded-entry-inline (e.g. merge tags), extract text or show placeholder
    if (node.nodeType === 'embedded-entry-inline') {
      return <Text key={index}>[…]</Text>;
    }
    // Hyperlinks
    if (node.nodeType === 'hyperlink') {
      const linkText = node.content ? node.content.map(extractText).join('') : 'Link';
      return (
        <Text key={index} style={styles.link}>
          {linkText}
        </Text>
      );
    }
    return null;
  });
}

/**
 * Simple RichText renderer for React Native.
 * Handles: document, paragraphs, headings 1-6, bold/italic/underline marks,
 * hyperlinks, and embedded inline entries (as fallback text).
 */
export default function RichTextRenderer({ document, style }: RichTextRendererProps) {
  if (!document || !document.content) {
    return null;
  }

  return <>{document.content.map((node, index) => renderBlockNode(node, index, style))}</>;
}

function renderBlockNode(node: RichTextNode, index: number, parentStyle?: object): React.ReactNode {
  switch (node.nodeType) {
    case 'paragraph':
      return (
        <Text key={index} style={[styles.paragraph, parentStyle]}>
          {node.content ? renderInlineContent(node.content) : null}
        </Text>
      );
    case 'heading-1':
      return (
        <Text key={index} style={[styles.heading1, parentStyle]}>
          {node.content ? renderInlineContent(node.content) : null}
        </Text>
      );
    case 'heading-2':
      return (
        <Text key={index} style={[styles.heading2, parentStyle]}>
          {node.content ? renderInlineContent(node.content) : null}
        </Text>
      );
    case 'heading-3':
      return (
        <Text key={index} style={[styles.heading3, parentStyle]}>
          {node.content ? renderInlineContent(node.content) : null}
        </Text>
      );
    case 'heading-4':
    case 'heading-5':
    case 'heading-6':
      return (
        <Text key={index} style={[styles.heading4, parentStyle]}>
          {node.content ? renderInlineContent(node.content) : null}
        </Text>
      );
    case 'unordered-list':
    case 'ordered-list':
      return (
        <React.Fragment key={index}>
          {node.content?.map((item, i) => renderBlockNode(item, i, parentStyle))}
        </React.Fragment>
      );
    case 'list-item':
      return (
        <Text key={index} style={[styles.listItem, parentStyle]}>
          {'  •  '}
          {node.content?.map((child, i) => {
            if (child.nodeType === 'paragraph') {
              return child.content ? renderInlineContent(child.content) : null;
            }
            return renderBlockNode(child, i, parentStyle);
          })}
        </Text>
      );
    case 'hr':
      return <Text key={index} style={styles.hr}>{'─'.repeat(40)}</Text>;
    case 'blockquote':
      return (
        <Text key={index} style={[styles.blockquote, parentStyle]}>
          {node.content?.map((child, i) => renderBlockNode(child, i, parentStyle))}
        </Text>
      );
    default:
      // Fallback: try to extract text
      if (node.content) {
        return (
          <Text key={index} style={parentStyle}>
            {node.content.map(extractText).join('')}
          </Text>
        );
      }
      return null;
  }
}

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 8,
  },
  heading1: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 40,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    lineHeight: 32,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 28,
  },
  heading4: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
    lineHeight: 26,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  link: {
    color: '#0070F3',
    textDecorationLine: 'underline',
  },
  listItem: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 4,
    paddingLeft: 8,
  },
  hr: {
    color: '#d1d5db',
    marginVertical: 12,
    textAlign: 'center',
  },
  blockquote: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#6b7280',
    borderLeftColor: '#0070F3',
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginVertical: 8,
  },
});
