/**
 * Alerte de fin de repos : notification locale (même app en arrière-plan) +
 * son. Le canal Android et la permission sont préparés une seule fois.
 *
 * Le son « app » est joué par l'écran de séance (expo-audio) quand l'app est au
 * premier plan ; en arrière-plan c'est la notification qui sonne (le JS est
 * suspendu). Le gestionnaire ci-dessous coupe donc le son de la notification
 * quand l'app est active, pour éviter un doublon.
 *
 * Les traces `[repos]` servent au diagnostic dans le terminal Expo.
 */

import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

/** Canal Android dédié (son court, importance haute). */
export const REST_CHANNEL_ID = 'rest';

const LOG = '[repos]';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    // On ne lit rien de la notification ici : une exception dans ce handler
    // ferait jeter la notification par Expo (comportement par défaut).
    const active = AppState.currentState === 'active';
    console.log(`${LOG} notification reçue (app ${active ? 'au premier plan' : 'en arrière-plan'})`);
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      // Au premier plan, c'est le bip de l'app qui sonne : pas de doublon.
      shouldPlaySound: !active,
      shouldSetBadge: false,
    };
  },
});

/**
 * Crée le canal de notification et demande la permission (idempotent).
 * Chaque étape est isolée : un échec du canal ne doit pas empêcher la demande
 * de permission (et inversement).
 */
export async function ensureRestNotifications(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Fin de repos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250],
    });
    console.log(`${LOG} canal « ${REST_CHANNEL_ID} » prêt`);
  } catch (error) {
    console.warn(`${LOG} canal indisponible :`, messageOf(error));
  }

  try {
    const before = await Notifications.getPermissionsAsync();
    console.log(`${LOG} permission avant demande :`, describePermission(before));
    if (!before.granted) {
      const after = await Notifications.requestPermissionsAsync();
      console.log(`${LOG} permission après demande :`, describePermission(after));
    }
  } catch (error) {
    console.warn(`${LOG} permission indisponible :`, messageOf(error));
  }
}

/**
 * Notification de fin de repos **différée** : c'est le seul moyen de prévenir
 * quand l'app est en arrière-plan (le JS est suspendu, ni le bip ni un appel
 * immédiat ne peuvent partir). Utilisée uniquement dans ce cas.
 */
export async function scheduleRestDone(seconds: number): Promise<string> {
  const inSeconds = Math.max(1, Math.round(seconds));
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: REST_CONTENT,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: inSeconds,
        channelId: REST_CHANNEL_ID,
      },
    });
    const planned = await Notifications.getAllScheduledNotificationsAsync();
    console.log(
      `${LOG} notification DIFFÉRÉE dans ${inSeconds} s (id ${identifier}, ` +
        `${planned.length} en attente)`
    );
    return identifier;
  } catch (error) {
    console.warn(`${LOG} programmation différée impossible :`, messageOf(error));
    throw error;
  }
}

/**
 * Notification de fin de repos **immédiate** (app au premier plan). Un trigger
 * « canal seul » provoque une présentation directe : c'est le chemin le plus
 * fiable, celui de l'exemple officiel, et il passe par le gestionnaire.
 */
export async function presentRestDoneNow(): Promise<void> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: REST_CONTENT,
      trigger: { channelId: REST_CHANNEL_ID },
    });
    console.log(`${LOG} notification IMMÉDIATE présentée (id ${identifier})`);
  } catch (error) {
    console.warn(`${LOG} présentation immédiate impossible :`, messageOf(error));
  }
}

const REST_CONTENT: Notifications.NotificationContentInput = {
  title: 'Repos terminé',
  body: 'Enchaîne la série suivante 💪',
  sound: 'default',
};

/**
 * Diagnostic : à chaque retour au premier plan, indique combien de
 * notifications de fin de repos sont encore en attente côté OS.
 *
 * Une notification différée « consommée » a été retirée du magasin par le
 * déclencheur ; si elle est encore là, c'est que l'alarme n'a jamais sonné
 * (limitation possible d'Expo Go — un build de développement est alors requis).
 */
export async function logPendingRestNotifications(): Promise<void> {
  try {
    const planned = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`${LOG} retour au premier plan : ${planned.length} notification(s) en attente`);
  } catch (error) {
    console.warn(`${LOG} lecture des notifications en attente impossible :`, messageOf(error));
  }
}

/** Annule une notification de fin de repos programmée (sans erreur si absente). */
export async function cancelRestDone(identifier: string | null): Promise<void> {
  if (!identifier) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`${LOG} notification annulée (id ${identifier})`);
  } catch (error) {
    console.warn(`${LOG} annulation impossible (id ${identifier}) :`, messageOf(error));
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describePermission(permission: Notifications.NotificationPermissionsStatus): string {
  return `granted=${permission.granted} status=${permission.status} canAskAgain=${permission.canAskAgain}`;
}
