import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const addReaction = async (req: Request, res: Response) => {
  try {
    const { messageId, userId, emoji } = req.body;

    // Validate required fields
    if (!messageId || !userId || !emoji) {
      return res.status(400).json({ 
        success: false, 
        message: 'MessageId, userId, and emoji are required'  
      });
    }

    // Check if message exists
    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user has already reacted with this emoji
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        messageId,
        userId,
        emoji
      }
    });

    if (existingReaction) {
      return res.status(400).json({ 
        success: false, 
        message: 'User has already reacted with this emoji' 
      });
    }

    // Create new reaction
    const reaction = await prisma.reaction.create({
      data: {
        messageId,
        userId,
        emoji
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullname: true,
            profilePic: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Reaction added successfully',
      data: reaction
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const removeReaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if reaction exists
    const reaction = await prisma.reaction.findUnique({
      where: { id }
    });

    if (!reaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reaction not found' 
      });
    }

    // Delete reaction
    await prisma.reaction.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Reaction removed successfully'
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getReactions = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    // Check if message exists
    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }

    // Get all reactions for the message
    const reactions = await prisma.reaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullname: true,
            profilePic: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      const { emoji } = reaction;
      if (!acc[emoji]) {
        acc[emoji] = [];
      }
      acc[emoji].push(reaction);
      return acc;
    }, {} as Record<string, typeof reactions>);

    return res.status(200).json({
      success: true,
      message: 'Reactions retrieved successfully',
      data: {
        count: reactions.length,
        reactions: groupedReactions
      }
    });
  } catch (error) {
    console.error('Error getting reactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};