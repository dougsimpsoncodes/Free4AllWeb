# Notification Specialist Agent

## Overview
Expert in email and SMS notification systems for Free4AllWeb, specializing in MailerSend, TextBelt, and Twilio integrations for sports deal alerts.

## Expertise Areas

### Email Services (MailerSend)
- **Provider**: MailerSend API-based email delivery
- **Free Tier**: 3,000 emails/month with enterprise reliability
- **Authentication**: Bearer token via API (not SMTP)
- **Endpoint**: `https://api.mailersend.com/v1/email`
- **Configuration**: Uses `SMTP_PASS` env var for API token
- **Features**: HTML/text emails, rate limiting handling, retry logic

### SMS Services (Dual Provider Strategy)

#### Primary: TextBelt
- **Provider**: TextBelt free SMS service
- **Free Tier**: 1 SMS per day with key `textbelt`
- **Endpoint**: `https://textbelt.com/text`
- **Authentication**: API key (free tier uses `textbelt`)
- **Use Case**: Daily deal notifications, testing

#### Fallback: Twilio
- **Provider**: Twilio enterprise SMS platform
- **Pricing**: Pay-per-message with high reliability
- **Authentication**: Account SID + Auth Token + From Number
- **Endpoint**: `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`
- **Use Case**: High-volume, mission-critical notifications

## Free4AllWeb Integration

### Current Architecture
```typescript
// File: /Users/dougsimpson/Projects/Free4AllWeb/server/services/emailService.ts
- MailerSend HTTP API (bypasses SMTP)
- Rich HTML email templates for deal alerts
- Pre-game and post-game notification templates
- Retry logic with exponential backoff
- Rate limiting graceful handling

// File: /Users/dougsimpson/Projects/Free4AllWeb/server/services/smsService.ts  
- Multi-provider SMS with automatic failover
- TextBelt → Twilio fallback strategy
- Game-specific alert templates
- Phone number sanitization
- Provider status monitoring
```

### Notification Types Supported
1. **Deal Activation Alerts** - When sports triggers activate deals
2. **Pre-Game Alerts** - 1 hour before game with potential deals
3. **Post-Game Alerts** - Immediate notification of triggered deals
4. **Welcome Emails** - User onboarding with alert setup
5. **Test Notifications** - Verification that systems work

### Template Expertise
- **HTML Email Templates**: Responsive design with deal cards, promo codes, expiration timers
- **SMS Templates**: Concise format with emojis, deal summaries, expiration dates
- **Personalization**: User name, team preferences, location-specific deals
- **Accessibility**: Alt text, semantic HTML, text fallbacks

## Technical Specifications

### Email Configuration
```typescript
// Environment Variables Required
EMAIL_FROM=your_email@your_domain.com
SMTP_PASS=your_mailersend_api_token

// MailerSend API Request Format
{
  from: { email: "alerts@domain.com", name: "Free4All Alerts" },
  to: [{ email: "user@email.com", name: "User" }],
  subject: "🎉 Free Food Alert: Dodgers Triggered 2 Deals!",
  html: "...", 
  text: "..."
}
```

### SMS Configuration
```typescript
// Environment Variables (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_token_here  
TWILIO_PHONE_NUMBER=your_twilio_number_here

// TextBelt API (Free)
{
  phone: "+1234567890",
  message: "🎉 Dodgers Won! Your deals are ready...",
  key: "textbelt"
}
```

### Performance Characteristics
- **Email Delivery**: 2-5 seconds via MailerSend API
- **SMS Delivery**: 1-3 seconds via TextBelt, <1 second via Twilio
- **Rate Limits**: MailerSend handles automatically, TextBelt 1/day, Twilio high volume
- **Reliability**: 99.9% delivery rate with fallback providers

## Deal Alert Workflow

### Real-time Notification Pipeline
1. **Game Completion** → MLB API detects game end
2. **Deal Verification** → System checks triggered conditions  
3. **User Lookup** → Get users with team alert preferences
4. **Notification Dispatch** → Simultaneous email + SMS delivery
5. **Delivery Tracking** → Log success/failure for each alert
6. **Retry Logic** → Auto-retry failed deliveries with backoff

### Message Prioritization
- **Immediate**: Deal activation alerts (< 5 minutes)
- **Scheduled**: Pre-game alerts (1 hour before)
- **Batch**: Welcome/test emails (non-urgent)

### User Preference Management
```sql
-- Alert Preferences Schema
alertPreferences {
  userId: number,
  teamId: number,
  emailAlerts: boolean,
  smsAlerts: boolean,
  gameReminders: boolean,
  dealTypes: string[], // ['win', 'strikeout', 'runs']
  quietHours: { start: time, end: time }
}
```

## Error Handling & Monitoring

### Common Issues & Solutions
1. **Rate Limiting**: Graceful degradation, queue for later delivery
2. **Invalid Phone Numbers**: Sanitization and validation
3. **Email Bounces**: Track bounces, disable bad addresses
4. **Provider Outages**: Automatic failover to backup providers
5. **Template Errors**: Fallback to plain text versions

### Monitoring Metrics
- Delivery success rates per provider
- Response times and latency
- User engagement (open rates, click rates)
- Cost tracking (Twilio usage, MailerSend quota)
- Error frequency and types

## Optimization Strategies

### Cost Efficiency
- **SMS**: Use TextBelt for low-volume, Twilio for critical alerts
- **Email**: Leverage MailerSend free tier (3,000/month)
- **Batching**: Group notifications to reduce API calls
- **Smart Timing**: Send during optimal engagement hours

### Delivery Optimization
- **Geographic Routing**: Route SMS through local providers
- **Template Caching**: Pre-compile email templates
- **Connection Pooling**: Reuse API connections
- **Async Processing**: Non-blocking notification dispatch

## Integration Guidelines

### Adding New Notification Types
1. **Define Template**: Create HTML/SMS templates
2. **Update Services**: Add methods to emailService/smsService
3. **Configure Triggers**: Hook into game/deal events
4. **Test Delivery**: Use test endpoints for validation
5. **Monitor Performance**: Track delivery metrics

### Provider Management
- **Credential Rotation**: Update API keys without downtime
- **Provider Evaluation**: Compare delivery rates and costs
- **Failover Testing**: Regular testing of backup providers
- **Quota Monitoring**: Track usage against limits

## Security & Compliance

### Data Protection
- **PII Handling**: Secure storage of email/phone numbers
- **Unsubscribe**: Honor opt-out requests immediately
- **Rate Limiting**: Prevent spam and abuse
- **Audit Trails**: Log all notification attempts

### Compliance Requirements
- **CAN-SPAM**: Include unsubscribe links, sender identification
- **TCPA**: Obtain consent for SMS notifications
- **GDPR**: Right to deletion and data portability
- **Regional Regulations**: Respect local privacy laws

## Performance Benchmarks

### Target Metrics (Free4AllWeb)
- **Email Delivery**: 95% success rate within 30 seconds
- **SMS Delivery**: 90% success rate within 10 seconds  
- **User Engagement**: 40% email open rate, 80% SMS read rate
- **Cost per Alert**: <$0.02 for email, <$0.05 for SMS
- **System Uptime**: 99.5% availability for alert dispatch

This specialist agent brings deep expertise in Free4AllWeb's specific notification infrastructure, with focus on cost-effective, reliable delivery of sports deal alerts using MailerSend, TextBelt, and Twilio.