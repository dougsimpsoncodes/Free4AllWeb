// Add extraction statistics endpoint
import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Get extraction statistics
router.get('/api/admin/discovery/stats', async (req, res) => {
  try {
    const sites = await storage.getDiscoveredSites();
    
    const stats = {
      totalSites: sites.length,
      extractedSites: sites.filter(site => site.dealExtracted).length,
      pendingSites: sites.filter(site => !site.dealExtracted).length,
      bySource: {
        newsArticles: sites.filter(site => 
          site.url.includes('sbsun.com') || 
          site.url.includes('dodgersnation.com') ||
          site.url.includes('latimes.com') ||
          site.url.includes('abc7.com')
        ).length,
        socialMedia: sites.filter(site => 
          site.url.includes('x.com') || 
          site.url.includes('twitter.com') ||
          site.url.includes('reddit.com') ||
          site.url.includes('facebook.com')
        ).length,
        officialRestaurants: sites.filter(site => 
          site.url.includes('pandaexpress.com') ||
          site.url.includes('mcdonalds.com') ||
          site.url.includes('jackinthebox.com')
        ).length
      },
      byRestaurant: {
        pandaExpress: sites.filter(site => site.restaurantDetected === 'Panda Express').length,
        mcdonalds: sites.filter(site => site.restaurantDetected === 'McDonald\'s').length,
        jackInTheBox: sites.filter(site => site.restaurantDetected === 'Jack in the Box').length,
        ampm: sites.filter(site => site.restaurantDetected === 'ampm').length,
        delTaco: sites.filter(site => site.restaurantDetected === 'Del Taco').length
      },
      extractionSuccessRate: {
        newsArticles: {
          total: sites.filter(site => 
            site.url.includes('sbsun.com') || 
            site.url.includes('dodgersnation.com') ||
            site.url.includes('latimes.com') ||
            site.url.includes('abc7.com')
          ).length,
          extracted: sites.filter(site => 
            (site.url.includes('sbsun.com') || 
             site.url.includes('dodgersnation.com') ||
             site.url.includes('latimes.com') ||
             site.url.includes('abc7.com')) &&
            site.dealExtracted
          ).length
        },
        socialMedia: {
          total: sites.filter(site => 
            site.url.includes('x.com') || 
            site.url.includes('twitter.com') ||
            site.url.includes('reddit.com') ||
            site.url.includes('facebook.com')
          ).length,
          extracted: sites.filter(site => 
            (site.url.includes('x.com') || 
             site.url.includes('twitter.com') ||
             site.url.includes('reddit.com') ||
             site.url.includes('facebook.com')) &&
            site.dealExtracted
          ).length
        }
      }
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting extraction stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;