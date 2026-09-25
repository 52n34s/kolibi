import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { instagramAppIdFrom, instagramStoryItems } from './instagram-stories.ts';

describe('instagramAppIdFrom', () => {
  it('accepts a numeric Facebook App ID', () => {
    assert.equal(instagramAppIdFrom('1234567890123456'), '1234567890123456');
    assert.equal(instagramAppIdFrom('  1234567890 '), '1234567890');
  });

  it('treats missing or odd values as not configured', () => {
    assert.equal(instagramAppIdFrom(undefined), null);
    assert.equal(instagramAppIdFrom(null), null);
    assert.equal(instagramAppIdFrom(''), null);
    assert.equal(instagramAppIdFrom('your-app-id'), null);
    assert.equal(instagramAppIdFrom('123'), null);
  });
});

describe('instagramStoryItems', () => {
  it('story card goes in as the background image', () => {
    assert.deepEqual(instagramStoryItems('file:///a.png', 'story', 'light'), {
      backgroundUri: 'file:///a.png',
    });
  });

  it('sticker goes in as a sticker on a contrasting backdrop', () => {
    const light = instagramStoryItems('file:///a.png', 'sticker', 'light');
    assert.equal(light.stickerUri, 'file:///a.png');
    assert.equal(light.backgroundUri, undefined);
    assert.equal(light.backgroundTopColor, '#2B2E36');
    const dark = instagramStoryItems('file:///a.png', 'sticker', 'dark');
    assert.equal(dark.backgroundTopColor, '#ECEBF6');
  });
});
