import { createClient } from 'contentful';
import {
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_ACCESS_TOKEN,
  CONTENTFUL_ENVIRONMENT,
} from '@env';

const client = createClient({
  space: CONTENTFUL_SPACE_ID,
  accessToken: CONTENTFUL_ACCESS_TOKEN,
  environment: CONTENTFUL_ENVIRONMENT,
});

export default client;

// Known entry IDs
export const CTA_ENTRY_ID = '5qUxVYOQgdCdCDJ7cenk9s';
