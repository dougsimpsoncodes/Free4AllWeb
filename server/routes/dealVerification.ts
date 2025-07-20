import { Router } from 'express';
import { dealVerificationService } from '../services/dealVerificationService';
import { storage } from '../storage';

const router = Router();

/**
 * Verify deals for a completed game
 * POST /api/deal-verification/verify-game/:gameId
 */
router.post('/verify-game/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const result = await dealVerificationService.verifyDealsForGame(gameId);
    
    res.json({
      success: true,
      gameId,
      ...result
    });
  } catch (error) {
    console.error('Error verifying deals for game:', error);
    res.status(500).json({ 
      error: 'Failed to verify deals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test deal verification for specific deal and game
 * POST /api/deal-verification/test
 */
router.post('/test', async (req, res) => {
  try {
    const { dealPageId, gameId } = req.body;
    
    if (!dealPageId || !gameId) {
      return res.status(400).json({ 
        error: 'Both dealPageId and gameId are required' 
      });
    }

    const result = await dealVerificationService.testDealVerification(
      parseInt(dealPageId), 
      parseInt(gameId)
    );
    
    res.json({
      success: true,
      test: result
    });
  } catch (error) {
    console.error('Error testing deal verification:', error);
    res.status(500).json({ 
      error: 'Failed to test deal verification',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all active triggered deals
 * GET /api/deal-verification/active-deals
 */
router.get('/active-deals', async (req, res) => {
  try {
    const activeDeals = await dealVerificationService.getActiveTriggeredDeals();
    
    res.json({
      success: true,
      activeDeals,
      count: activeDeals.length
    });
  } catch (error) {
    console.error('Error getting active deals:', error);
    res.status(500).json({ 
      error: 'Failed to get active deals',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all available deal pages for testing
 * GET /api/deal-verification/deal-pages
 */
router.get('/deal-pages', async (req, res) => {
  try {
    const dealPages = await storage.getActiveDealPages();
    
    res.json({
      success: true,
      dealPages: dealPages.map(page => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        restaurant: page.restaurant,
        triggerCondition: page.triggerCondition,
        dealValue: page.dealValue,
        promoCode: page.promoCode
      })),
      count: dealPages.length
    });
  } catch (error) {
    console.error('Error getting deal pages:', error);
    res.status(500).json({ 
      error: 'Failed to get deal pages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get recent games for testing
 * GET /api/deal-verification/recent-games/:teamId
 */
router.get('/recent-games/:teamId', async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' });
    }

    const games = await storage.getRecentGames(teamId, limit);
    
    res.json({
      success: true,
      teamId,
      games: games.map(game => ({
        id: game.id,
        opponent: game.opponent,
        gameDate: game.gameDate,
        isHome: game.isHome,
        teamScore: game.teamScore,
        opponentScore: game.opponentScore,
        isComplete: game.isComplete,
        gameStats: game.gameStats
      })),
      count: games.length
    });
  } catch (error) {
    console.error('Error getting recent games:', error);
    res.status(500).json({ 
      error: 'Failed to get recent games',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Parse trigger condition for debugging
 * POST /api/deal-verification/parse-condition
 */
router.post('/parse-condition', async (req, res) => {
  try {
    const { condition } = req.body;
    
    if (!condition) {
      return res.status(400).json({ error: 'Condition is required' });
    }

    // Create a mock game to test parsing
    const mockGame = {
      id: 0,
      teamId: 119, // Dodgers
      opponent: 'Test Opponent',
      gameDate: new Date(),
      isHome: true,
      teamScore: 8,
      opponentScore: 3,
      isComplete: true,
      gameStats: {
        runs: 8,
        hits: 12,
        strikeOuts: 8,
        pitchingStrikeOuts: 9,
        stolenBases: 2,
        walks: 3
      }
    };

    // Test the condition parsing using our verification service
    const service = dealVerificationService as any;
    const result = await service.evaluateTriggerCondition(condition, mockGame);
    
    res.json({
      success: true,
      condition,
      mockGame,
      triggered: result,
      explanation: `Condition "${condition}" ${result ? 'would be' : 'would NOT be'} triggered by this mock game`
    });
  } catch (error) {
    console.error('Error parsing condition:', error);
    res.status(500).json({ 
      error: 'Failed to parse condition',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;