import express from 'express';
import { EmailService } from '../services/emailService';

const router = express.Router();
const emailService = new EmailService();

// Showcase all email types that the system sends
router.post('/showcase', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    console.log(`Sending email showcase to ${email}...`);

    // 1. Welcome Email
    await emailService.sendWelcomeEmail(email, 'Test User');
    console.log('✅ Sent: Welcome Email');

    // Wait 5 seconds between emails to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Pre-game Alert
    await emailService.sendPreGameAlert(email, {
      homeTeam: 'LA Dodgers',
      awayTeam: 'San Francisco Giants',
      gameTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      venue: 'Dodger Stadium',
      potentialDeals: [
        {
          restaurant: 'Panda Express',
          offer: '$6 Panda Plate Deal',
          trigger: 'Dodgers win any game'
        },
        {
          restaurant: 'McDonald\'s',
          offer: 'Free Big Mac',
          trigger: 'Dodgers win home game with 6+ runs'
        }
      ]
    });
    console.log('✅ Sent: Pre-game Alert');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Post-game Victory Alert with Triggered Deals
    await emailService.sendPostGameAlert(email, {
      homeTeam: 'LA Dodgers',
      awayTeam: 'San Francisco Giants',
      finalScore: 'Dodgers 8, Giants 3',
      gameDate: new Date(),
      triggeredDeals: [
        {
          restaurant: 'Panda Express',
          offer: '$6 Panda Plate Deal',
          promoCode: 'DODGERSWIN',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          instructions: 'Show this email at any Panda Express location'
        },
        {
          restaurant: 'McDonald\'s',
          offer: 'Free Big Mac',
          promoCode: 'DODGERS8RUNS',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          instructions: 'Use mobile app or mention promo code at counter'
        }
      ]
    });
    console.log('✅ Sent: Post-game Victory Alert');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Deal Expiration Reminder
    await emailService.sendDealExpirationReminder(email, [
      {
        restaurant: 'Jack in the Box',
        offer: 'Free Curly Fries',
        promoCode: 'STRIKEOUT7',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        instructions: 'Present this email at participating locations'
      }
    ]);
    console.log('✅ Sent: Deal Expiration Reminder');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Weekly Deal Summary
    await emailService.sendWeeklyDealSummary(email, {
      weekOf: new Date(),
      totalTriggeredDeals: 5,
      totalSavings: '$47.50',
      topRestaurants: ['Panda Express', 'McDonald\'s', 'Jack in the Box'],
      upcomingGames: [
        {
          opponent: 'Colorado Rockies',
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          venue: 'Dodger Stadium'
        }
      ]
    });
    console.log('✅ Sent: Weekly Deal Summary');

    res.json({ 
      success: true, 
      message: `Email showcase sent to ${email}`,
      emailsSent: [
        'Welcome Email',
        'Pre-game Alert', 
        'Post-game Victory Alert',
        'Deal Expiration Reminder',
        'Weekly Deal Summary'
      ]
    });

  } catch (error) {
    console.error('Error sending email showcase:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;