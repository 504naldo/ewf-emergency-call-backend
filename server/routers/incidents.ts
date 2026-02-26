import { Router } from 'express';
import { db } from '../db';
import { incidents, users } from '../../drizzle/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { notifyAvailableTechnicians } from '../_core/push-notifications';

const router = Router();

// Get all incidents
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let query = db.select().from(incidents);
    
    if (status) {
      query = query.where(eq(incidents.status, status as string));
    }
    
    const allIncidents = await query.orderBy(desc(incidents.createdAt));
    
    // Filter by search if provided
    let filteredIncidents = allIncidents;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredIncidents = allIncidents.filter(
        (incident) =>
          incident.buildingId?.toLowerCase().includes(searchLower) ||
          incident.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Get assigned technicians
    const incidentsWithTechs = await Promise.all(
      filteredIncidents.map(async (incident) => {
        if (incident.assignedTechnicianId) {
          const tech = await db
            .select()
            .from(users)
            .where(eq(users.id, incident.assignedTechnicianId))
            .limit(1);
          
          return {
            ...incident,
            technician: tech[0] || null,
          };
        }
        return incident;
      })
    );
    
    res.json(incidentsWithTechs);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ message: 'Failed to fetch incidents' });
  }
});

// Get single incident
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const incident = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, parseInt(id)))
      .limit(1);
    
    if (!incident[0]) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    
    // Get assigned technician if exists
    if (incident[0].assignedTechnicianId) {
      const tech = await db
        .select()
        .from(users)
        .where(eq(users.id, incident[0].assignedTechnicianId))
        .limit(1);
      
      return res.json({
        ...incident[0],
        technician: tech[0] || null,
      });
    }
    
    res.json(incident[0]);
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ message: 'Failed to fetch incident' });
  }
});

// Create new incident
router.post('/', async (req, res) => {
  try {
    const { building_id, description, priority, assigned_technician_id } = req.body;
    
    if (!building_id || !description) {
      return res.status(400).json({ message: 'building_id and description are required' });
    }
    
    const newIncident = await db
      .insert(incidents)
      .values({
        buildingId: building_id,
        description,
        priority: priority || 'medium',
        status: 'pending',
        assignedTechnicianId: assigned_technician_id || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    // Send push notification to available technicians
    try {
      await notifyAvailableTechnicians({
        title: '🚨 New Emergency Incident',
        body: `${building_id}: ${description}`,
        data: {
          incidentId: newIncident[0].id,
          buildingId: building_id,
          priority: priority || 'medium',
          type: 'new_incident',
        },
      });
    } catch (notifError) {
      console.error('Failed to send push notification:', notifError);
      // Don't fail the request if notification fails
    }
    
    res.status(201).json(newIncident[0]);
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ message: 'Failed to create incident' });
  }
});

// Update incident
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Convert snake_case to camelCase for database
    const dbUpdates: any = {
      updatedAt: new Date(),
    };
    
    if (updates.building_id !== undefined) dbUpdates.buildingId = updates.building_id;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.assigned_technician_id !== undefined) {
      dbUpdates.assignedTechnicianId = updates.assigned_technician_id;
    }
    
    const updated = await db
      .update(incidents)
      .set(dbUpdates)
      .where(eq(incidents.id, parseInt(id)))
      .returning();
    
    if (!updated[0]) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ message: 'Failed to update incident' });
  }
});

// Delete incident
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.delete(incidents).where(eq(incidents.id, parseInt(id)));
    
    res.json({ message: 'Incident deleted successfully' });
  } catch (error) {
    console.error('Error deleting incident:', error);
    res.status(500).json({ message: 'Failed to delete incident' });
  }
});

export default router;
