#!/bin/bash

# APNs Security Monitoring Script
# Monitors APNs credential security and sends alerts for security issues

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/apns-security.log"
ALERT_EMAIL="${ALERT_EMAIL:-admin@free4allweb.com}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Alert function
send_alert() {
    local severity="$1"
    local message="$2"
    
    log "ALERT [$severity]: $message"
    
    # Send email alert if configured
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "Free4AllWeb APNs Security Alert [$severity]" "$ALERT_EMAIL"
    fi
    
    # Send Slack alert if webhook configured
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Free4AllWeb APNs Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK" >/dev/null 2>&1 || true
    fi
}

# Check file permissions
check_file_permissions() {
    log "Checking APNs credential file permissions..."
    
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        local env_perms=$(stat -f "%Mp%Lp" "$PROJECT_ROOT/.env" 2>/dev/null || stat -c "%a" "$PROJECT_ROOT/.env" 2>/dev/null)
        if [[ "$env_perms" != "600" ]]; then
            send_alert "HIGH" ".env file has insecure permissions: $env_perms (should be 600)"
        fi
    fi
    
    # Check credentials directory
    if [[ -d "$PROJECT_ROOT/credentials" ]]; then
        local cred_perms=$(stat -f "%Mp%Lp" "$PROJECT_ROOT/credentials" 2>/dev/null || stat -c "%a" "$PROJECT_ROOT/credentials" 2>/dev/null)
        if [[ "$cred_perms" != "700" ]]; then
            send_alert "HIGH" "credentials/ directory has insecure permissions: $cred_perms (should be 700)"
        fi
        
        # Check .p8 files
        find "$PROJECT_ROOT/credentials" -name "*.p8" -type f | while read -r p8_file; do
            local p8_perms=$(stat -f "%Mp%Lp" "$p8_file" 2>/dev/null || stat -c "%a" "$p8_file" 2>/dev/null)
            if [[ "$p8_perms" != "600" ]]; then
                send_alert "CRITICAL" "APNs key file has insecure permissions: $p8_file ($p8_perms, should be 600)"
            fi
        done
    fi
}

# Check for credential exposure in git
check_git_exposure() {
    log "Checking for APNs credential exposure in git..."
    
    cd "$PROJECT_ROOT"
    
    # Check if .env is tracked
    if git ls-files --error-unmatch .env >/dev/null 2>&1; then
        send_alert "CRITICAL" ".env file is tracked in git repository"
    fi
    
    # Check if credentials directory is tracked
    if git ls-files --error-unmatch credentials/ >/dev/null 2>&1; then
        send_alert "CRITICAL" "credentials/ directory is tracked in git repository"
    fi
    
    # Check for .p8 files in git history
    if git log --all --full-history -- "*.p8" | grep -q commit; then
        send_alert "CRITICAL" "APNs .p8 files found in git history - requires BFG cleanup"
    fi
    
    # Check for APNs keys in git history
    if git log --all --grep="BEGIN PRIVATE KEY" | grep -q commit; then
        send_alert "CRITICAL" "Private keys may be exposed in git commit messages"
    fi
}

# Check environment variable security
check_env_security() {
    log "Checking environment variable security..."
    
    # Source .env if it exists
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        # Check for required variables
        local required_vars=("APNS_KEY_ID" "APNS_TEAM_ID" "APNS_BUNDLE_ID" "APNS_PRIVATE_KEY_PATH")
        local missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if ! grep -q "^$var=" "$PROJECT_ROOT/.env"; then
                missing_vars+=("$var")
            fi
        done
        
        if [[ ${#missing_vars[@]} -gt 0 ]]; then
            send_alert "MEDIUM" "Missing APNs environment variables: ${missing_vars[*]}"
        fi
        
        # Check for hardcoded keys in .env (should use file path instead)
        if grep -q "APNS_AUTH_KEY.*BEGIN PRIVATE KEY" "$PROJECT_ROOT/.env"; then
            send_alert "HIGH" "APNs private key is hardcoded in .env file (should use file path)"
        fi
    else
        send_alert "HIGH" ".env file not found"
    fi
}

# Check APNs service status
check_apns_status() {
    log "Checking APNs service status..."
    
    # Check if server is running and APNs is configured
    local api_url="http://localhost:5001/api/admin/apns/status"
    
    if command -v curl >/dev/null 2>&1; then
        local response=$(curl -s -w "%{http_code}" -o /tmp/apns_status.json "$api_url" 2>/dev/null || echo "000")
        
        if [[ "$response" == "200" ]]; then
            if jq -e '.apns.configured == false' /tmp/apns_status.json >/dev/null 2>&1; then
                send_alert "HIGH" "APNs service is not properly configured"
            fi
            
            # Check environment
            local env=$(jq -r '.apns.environment // "unknown"' /tmp/apns_status.json 2>/dev/null)
            if [[ "$env" == "sandbox" ]] && [[ "${NODE_ENV:-}" == "production" ]]; then
                send_alert "MEDIUM" "APNs is in sandbox mode but NODE_ENV is production"
            fi
        else
            log "Unable to check APNs status via API (HTTP $response)"
        fi
        
        rm -f /tmp/apns_status.json
    fi
}

# Check for outdated credentials
check_credential_age() {
    log "Checking APNs credential age..."
    
    # Check .p8 file age (recommend rotation every 6 months)
    find "$PROJECT_ROOT/credentials" -name "*.p8" -type f 2>/dev/null | while read -r p8_file; do
        local file_age_days=$(( ($(date +%s) - $(stat -f %m "$p8_file" 2>/dev/null || stat -c %Y "$p8_file" 2>/dev/null)) / 86400 ))
        
        if [[ $file_age_days -gt 180 ]]; then
            send_alert "MEDIUM" "APNs credential file is $file_age_days days old (recommend rotation every 180 days): $p8_file"
        fi
    done
}

# Main monitoring function
main() {
    log "Starting APNs security monitoring..."
    
    check_file_permissions
    check_git_exposure
    check_env_security
    check_apns_status
    check_credential_age
    
    log "APNs security monitoring completed"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi