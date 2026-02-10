import {
  CONTENTFUL_ACCESS_TOKEN,
  CONTENTFUL_ENVIRONMENT,
  CONTENTFUL_SPACE_ID,
} from '@env';
import { createClient } from 'contentful';

const client = createClient({
  space: CONTENTFUL_SPACE_ID,
  accessToken: CONTENTFUL_ACCESS_TOKEN,
  environment: CONTENTFUL_ENVIRONMENT,
});

export default client;

// Known entry IDs
export const CTA_ENTRY_ID = '5qUxVYOQgdCdCDJ7cenk9s';
