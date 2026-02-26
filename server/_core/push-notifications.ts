import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../db';
import { notifications, users } from '../../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';

const expo = new Expo();

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to specific users
 */
export async function sendPushNotification(
  userIds: number[],
  notification: PushNotificationData
) {
  try {
    // Get push tokens for these users
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.userId, userIds));

    const pushTokens = userNotifications
      .filter((n) => n.enabled && n.expoPushToken && Expo.isExpoPushToken(n.expoPushToken))
      .map((n) => n.expoPushToken!);

    if (pushTokens.length === 0) {
      console.log('No valid push tokens found for users:', userIds);
      return;
    }

    // Create messages
    const messages: ExpoPushMessage[] = pushTokens.map((pushToken) => ({
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    }));

    // Send in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    console.log(`Sent ${tickets.length} push notifications`);
    return tickets;
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    throw error;
  }
}

/**
 * Send notification to all available technicians
 */
export async function notifyAvailableTechnicians(notification: PushNotificationData) {
  try {
    // Get all users with technician or manager role
    const availableTechs = await db
      .select()
      .from(users);

    const techIds = availableTechs
      .filter((u) => u.role === 'technician' || u.role === 'manager')
      .map((t) => t.id);
    
    if (techIds.length > 0) {
      await sendPushNotification(techIds, notification);
    }
  } catch (error) {
    console.error('Error notifying technicians:', error);
  }
}
