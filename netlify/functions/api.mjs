import { BlobStorage } from '../../server/storage.mjs';
import { createIdentityAuth } from '../../server/auth.mjs';
import { createApp } from '../../server/app.mjs';

const auth = createIdentityAuth();
export default async request => {
  return createApp({ store: new BlobStorage(), auth })(request);
};
