import { Router } from 'express';
import { db } from '../db';
import { notifications } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Register push token
router.post('/register-token', async (req, res) => {
  try {
    const { userId, pushToken } = req.body;

    if (!userId || !pushToken) {
      return res.status(400).json({ message: 'userId and pushToken are required' });
    }

    // Check if notification settings exist for this user
    const existing = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, parseInt(userId)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(notifications)
        .set({
          expoPushToken: pushToken,
          updatedAt: new Date(),
        })
        .where(eq(notifications.userId, parseInt(userId)));
    } else {
      // Insert new
      await db.insert(notifications).values({
        userId: parseInt(userId),
        expoPushToken: pushToken,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    res.json({ success: true, message: 'Push token registered' });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ message: 'Failed to register push token' });
  }
});

// Get user's notification settings
router.get('/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const settings = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, parseInt(userId)))
      .limit(1);
    
    res.json(settings[0] || { enabled: true });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

export default router;
