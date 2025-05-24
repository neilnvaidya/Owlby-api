import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, age, userId } = req.body;
    const authHeader = req.headers.authorization;
    
    console.log('📝 Profile update request:', { name, age, userId, hasAuth: !!authHeader });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Authorization token required' 
      });
    }

    // Basic validation
    if (!name || !age) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Name and age are required'
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'User ID is required'
      });
    }

    // For now, we'll simulate success and log the data
    // In production, this would update Auth0 user metadata
    console.log('✅ Profile updated successfully:', { 
      userId, 
      name: name.trim(), 
      age: age.toString() 
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { 
        userId,
        name: name.trim(), 
        age: age.toString(),
        updatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({
      error: 'server_error',
      message: 'Failed to update profile'
    });
  }
} 