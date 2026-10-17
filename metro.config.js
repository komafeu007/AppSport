// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Correctif Expo Go (Android).
 *
 * `expo-notifications` charge le module natif des « topics » push (Firebase)
 * dès l'import de son index (`topicSubscription`). Or Expo Go (Android) ne
 * l'embarque pas — il n'a plus de support du push depuis le SDK 53 — ce qui
 * faisait planter l'app au démarrage :
 * `Cannot find native module 'ExpoTopicSubscriptionModule'`.
 *
 * On n'utilise jamais les topics : on redirige donc ce seul import vers le
 * module de remplacement livré par le paquet (`TopicSubscriptionModule.js`,
 * celui utilisé quand le module natif n'existe pas). Les notifications locales
 * (planification, canaux, permissions…) restent inchangées.
 *
 * Amont : expo/expo#49044 — même classe de bug, corrigée partiellement en
 * 57.0.23 (expo/expo#51476) mais pas pour ce module. À retirer quand Expo Go
 * l'embarquera (ou en développement build, où le module natif existe).
 */
const NOTIFICATIONS_DIR = path.dirname(require.resolve('expo-notifications/package.json'));
const TOPIC_STANDIN = path.join(NOTIFICATIONS_DIR, 'build', 'TopicSubscriptionModule.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'android' &&
    moduleName === './TopicSubscriptionModule' &&
    context.originModulePath.includes('expo-notifications')
  ) {
    return { type: 'sourceFile', filePath: TOPIC_STANDIN };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
