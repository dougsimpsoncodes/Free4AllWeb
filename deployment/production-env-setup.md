# Production APNs Environment Setup

## Environment Variables for Production

### Required APNs Variables
```bash
# Apple Push Notifications (Production)
APNS_KEY_ID=ABC123DEF4
APNS_TEAM_ID=XYZ987UVW6
APNS_BUNDLE_ID=com.free4allweb.app
APNS_PRIVATE_KEY_PATH=/app/credentials/AuthKey_ABC123DEF4.p8
APNS_ENVIRONMENT=production
NODE_ENV=production
```

## Cloud Provider Setup

### AWS Secrets Manager
```bash
# Store APNs private key
aws secretsmanager create-secret \
  --name "free4allweb/apns/private-key" \
  --description "APNs private key for Free4AllWeb production" \
  --secret-binary fileb://AuthKey_ABC123DEF4.p8

# Store other credentials
aws secretsmanager create-secret \
  --name "free4allweb/apns/config" \
  --description "APNs configuration for Free4AllWeb production" \
  --secret-string '{
    "APNS_KEY_ID": "ABC123DEF4",
    "APNS_TEAM_ID": "XYZ987UVW6",
    "APNS_BUNDLE_ID": "com.free4allweb.app",
    "APNS_ENVIRONMENT": "production"
  }'
```

### Google Cloud Secret Manager
```bash
# Store APNs private key
gcloud secrets create apns-private-key \
  --data-file=AuthKey_ABC123DEF4.p8

# Store configuration
echo '{
  "APNS_KEY_ID": "ABC123DEF4",
  "APNS_TEAM_ID": "XYZ987UVW6", 
  "APNS_BUNDLE_ID": "com.free4allweb.app",
  "APNS_ENVIRONMENT": "production"
}' | gcloud secrets create apns-config --data-file=-
```

### Docker Secrets (Docker Swarm)
```bash
# Create Docker secrets
docker secret create apns_private_key AuthKey_ABC123DEF4.p8
docker secret create apns_key_id -
# (paste key ID and press Ctrl+D)
```

## Container Deployment

### Dockerfile Security
```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S free4allweb -u 1001

# Create secure credentials directory
RUN mkdir -p /app/credentials && \
    chown free4allweb:nodejs /app/credentials && \
    chmod 700 /app/credentials

USER free4allweb
```

### Kubernetes Deployment
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: apns-credentials
type: Opaque
data:
  private-key: <base64-encoded-p8-file>
  key-id: <base64-encoded-key-id>
  team-id: <base64-encoded-team-id>

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: free4allweb
spec:
  template:
    spec:
      containers:
      - name: app
        image: free4allweb:latest
        env:
        - name: APNS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: apns-credentials
              key: key-id
        - name: APNS_TEAM_ID
          valueFrom:
            secretKeyRef:
              name: apns-credentials
              key: team-id
        - name: APNS_BUNDLE_ID
          value: "com.free4allweb.app"
        - name: APNS_PRIVATE_KEY_PATH
          value: "/app/credentials/apns-key.p8"
        - name: APNS_ENVIRONMENT
          value: "production"
        volumeMounts:
        - name: apns-key
          mountPath: /app/credentials
          readOnly: true
      volumes:
      - name: apns-key
        secret:
          secretName: apns-credentials
          items:
          - key: private-key
            path: apns-key.p8
            mode: 0600
```

## Security Monitoring

### Log Analysis Queries
```bash
# Monitor APNs failures
grep "APNs.*failed" /var/log/app.log

# Track credential access
grep "APNs.*initialized" /var/log/app.log

# Monitor invalid tokens
grep "InvalidToken" /var/log/app.log
```

### Health Check Endpoint
Add to your monitoring:
```bash
curl -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  https://api.free4allweb.com/api/admin/apns/status
```

## Credential Rotation Schedule

### Quarterly Rotation (Recommended)
1. Generate new APNs key in Apple Developer portal
2. Update secrets in cloud provider
3. Deploy new credentials to staging
4. Test push notifications
5. Deploy to production
6. Revoke old APNs key
7. Update monitoring dashboards

### Emergency Rotation
1. Immediate revocation of compromised key
2. Emergency deployment of new credentials
3. Post-incident security review