/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.steffen.kolibi'],
  },
};
