# APNs Security Incident Response Plan

## Incident Types and Responses

### 1. Credential Exposure (CRITICAL)

**Immediate Actions (0-15 minutes):**
```bash
# 1. Revoke exposed APNs key immediately
# - Log into Apple Developer Portal
# - Navigate to Certificates, Identifiers & Profiles > Keys
# - Find the exposed key and click "Revoke"

# 2. Generate new APNs key
# - Create new key with same permissions
# - Download .p8 file to secure location
# - Record new Key ID

# 3. Remove exposed credentials from systems
rm -f /compromised/path/to/AuthKey_*.p8
```

**Recovery Actions (15-60 minutes):**
```bash
# 1. Deploy new credentials to all environments
# Update .env files
APNS_KEY_ID=NEW_KEY_ID_HERE
APNS_PRIVATE_KEY_PATH=./credentials/AuthKey_NEW_KEY_ID.p8

# 2. Update cloud secrets
aws secretsmanager update-secret \
  --secret-id "free4allweb/apns/private-key" \
  --secret-binary fileb://AuthKey_NEW_KEY_ID.p8

# 3. Restart all services
docker-compose down && docker-compose up -d

# 4. Verify APNs functionality
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.free4allweb.com/api/admin/apns/status
```

**Post-Incident Actions (1-24 hours):**
```bash
# 1. Audit git history for exposed credentials
git log --all --grep="BEGIN PRIVATE KEY"
git log --all --full-history -- "*.p8"

# 2. Clean git history if needed (use BFG Repo-Cleaner)
java -jar bfg.jar --delete-files "*.p8" --delete-files ".env"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 3. Update all team members
# 4. Review access logs
# 5. Document lessons learned
```

### 2. Invalid Device Tokens (MEDIUM)

**Symptoms:**
- High APNs failure rates
- "InvalidToken" errors in logs
- Users not receiving notifications

**Response:**
```bash
# 1. Check APNs error logs
grep "InvalidToken" /var/log/app.log | tail -50

# 2. Clean invalid tokens from database
# APNs service automatically marks invalid tokens as inactive

# 3. Monitor for improvement
curl -s http://localhost:5001/api/admin/apns/status | jq '.apns'
```

### 3. APNs Service Outage (HIGH)

**Symptoms:**
- All push notifications failing
- APNs provider connection errors
- Service marked as unconfigured

**Response:**
```bash
# 1. Check service configuration
curl -s http://localhost:5001/api/admin/apns/status

# 2. Verify credentials exist and are readable
ls -la ./credentials/AuthKey_*.p8
node scripts/test-apns-setup.js

# 3. Check Apple's system status
curl -s https://www.apple.com/support/systemstatus/

# 4. Restart service if needed
docker-compose restart app

# 5. Implement fallback notification system
# - Email notifications
# - SMS alerts for critical deals
```

### 4. Permission Issues (MEDIUM)

**Symptoms:**
- "Permission denied" errors
- APNs initialization failures
- File access errors

**Response:**
```bash
# 1. Fix file permissions
chmod 700 credentials/
chmod 600 credentials/AuthKey_*.p8
chmod 600 .env

# 2. Check ownership
chown app:app credentials/
chown app:app credentials/AuthKey_*.p8

# 3. Verify in containers
docker exec -it free4allweb_app ls -la credentials/
```

## Emergency Contacts

### Apple Developer Support
- Portal: https://developer.apple.com/contact/
- Phone: 1-800-633-2152 (US)
- Hours: Mon-Fri 9 AM - 7 PM PST

### Internal Team
- DevOps Lead: [phone/slack]
- Security Team: [contact info]
- On-call Engineer: [rotation schedule]

## Backup Verification

### Weekly Backup Check
```bash
#!/bin/bash
# Check backup integrity

# 1. Verify encrypted backup exists
gpg --list-packets ~/secure-backups/AuthKey_*.p8.gpg

# 2. Test decryption (without saving)
gpg --decrypt ~/secure-backups/AuthKey_*.p8.gpg > /dev/null

# 3. Verify backup recency
find ~/secure-backups -name "AuthKey_*.p8.gpg" -mtime -7
```

### Disaster Recovery Test
```bash
#!/bin/bash
# Quarterly DR test

# 1. Create test environment with backup credentials
mkdir -p /tmp/dr-test/credentials
gpg --decrypt ~/secure-backups/AuthKey_*.p8.gpg > /tmp/dr-test/credentials/AuthKey_TEST.p8

# 2. Test APNs initialization
APNS_PRIVATE_KEY_PATH=/tmp/dr-test/credentials/AuthKey_TEST.p8 \
APNS_KEY_ID=$BACKUP_KEY_ID \
APNS_TEAM_ID=$TEAM_ID \
APNS_BUNDLE_ID=com.free4allweb.app \
node -e "
const { apnsService } = require('./server/services/apnsService');
console.log('DR Test:', apnsService.getStatus());
"

# 3. Cleanup
rm -rf /tmp/dr-test
```

## Security Metrics and KPIs

### Daily Monitoring
- APNs success rate: > 95%
- Invalid token rate: < 5%
- Service availability: > 99.9%
- Credential file permissions: 600

### Weekly Reports
- Failed notification count
- Device token cleanup statistics
- Security scan results
- Backup verification status

### Monthly Reviews
- Credential age tracking
- Access log analysis
- Incident response time metrics
- Team training compliance

## Compliance and Auditing

### SOC 2 Type II Requirements
- Encryption at rest and in transit
- Access controls and monitoring
- Incident response documentation
- Regular security assessments

### Data Protection
- APNs tokens are user-specific
- No personal data in push payloads
- Respect user notification preferences
- Comply with GDPR/CCPA for EU/CA users

### Audit Trail
```bash
# Log all APNs-related actions
logger "APNs: Credential rotation started by $USER"
logger "APNs: Service restarted - new key ID: ${APNS_KEY_ID:0:4}***"
logger "APNs: Backup verification completed successfully"
```