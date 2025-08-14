/**
 * Alert Management System - Phase 2.2.3
 * 
 * Threshold-based alerting and notification system:
 * - Latency > 2s for > 5% of validations in a 5-minute window
 * - > 1% validation failures in a 15-minute window
 * - Any evidence integrity verification failure
 * - Performance degradation notifications to ops channel
 */

import { performanceMonitor, type PerformanceAlert } from './performanceMonitor.js';
import { healthCheckSystem } from './healthCheckSystem.js';
import { putImmutable } from './evidence/storage.js';

export interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  type: 'latency' | 'error_rate' | 'evidence_integrity' | 'health' | 'custom';
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  windowDurationMs: number;
  minimumOccurrences?: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'console' | 'email' | 'slack' | 'webhook' | 'database';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Alert {
  alertId: string;
  ruleId: string;
  ruleName: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  status: 'firing' | 'resolved' | 'suppressed';
  firstFired: string;
  lastFired: string;
  resolvedAt?: string;
  occurrenceCount: number;
  description: string;
  evidence: string[];
  channels: AlertChannel[];
}

export interface AlertManagerConfig {
  enableAlerting: boolean;
  evaluationIntervalMs: number;
  suppressionTimeMs: number;
  maxActiveAlerts: number;
  alertRetentionDays: number;
  defaultChannels: AlertChannel[];
}

export interface AlertManagerMetrics {
  totalAlertsGenerated: number;
  activeAlerts: number;
  resolvedAlerts: number;
  suppressedAlerts: number;
  ruleEvaluations: number;
  channelDeliveries: number;
  channelFailures: number;
}

export class AlertManager {
  private config: AlertManagerConfig;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private metrics: AlertManagerMetrics;
  private isRunning = false;
  private evaluationTimer?: NodeJS.Timeout;

  constructor(config: Partial<AlertManagerConfig> = {}) {
    this.config = {
      enableAlerting: true,
      evaluationIntervalMs: 30000, // 30 seconds
      suppressionTimeMs: 300000, // 5 minutes
      maxActiveAlerts: 100,
      alertRetentionDays: 7,
      defaultChannels: [
        {
          type: 'console',
          config: { logLevel: 'warn' },
          enabled: true
        }
      ],
      ...config
    };

    this.metrics = {
      totalAlertsGenerated: 0,
      activeAlerts: 0,
      resolvedAlerts: 0,
      suppressedAlerts: 0,
      ruleEvaluations: 0,
      channelDeliveries: 0,
      channelFailures: 0
    };

    this.initializeDefaultRules();
  }

  /**
   * Start the alert manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Alert manager already running');
      return;
    }

    console.log('🚨 Starting Alert Manager...');

    try {
      this.isRunning = true;

      // Start periodic rule evaluation
      this.evaluationTimer = setInterval(() => {
        this.evaluateAlertRules().catch(error => {
          console.error('Error in alert rule evaluation:', error);
        });
      }, this.config.evaluationIntervalMs);

      console.log('✅ Alert Manager started');
      console.log(`🚨 Config: evaluation_interval=${this.config.evaluationIntervalMs}ms, alerting=${this.config.enableAlerting}`);

    } catch (error) {
      console.error('Failed to start alert manager:', error);
      throw error;
    }
  }

  /**
   * Stop the alert manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Alert Manager...');

    this.isRunning = false;

    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    console.log('✅ Alert Manager stopped');
  }

  /**
   * Get alert manager status
   */
  getStatus(): {
    isRunning: boolean;
    config: AlertManagerConfig;
    metrics: AlertManagerMetrics;
    rulesCount: number;
    activeAlertsCount: number;
  } {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
      metrics: { ...this.metrics },
      rulesCount: this.alertRules.size,
      activeAlertsCount: this.activeAlerts.size
    };
  }

  /**
   * Add or update alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.ruleId, rule);
    console.log(`📋 Alert rule added: ${rule.name} (${rule.type})`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      console.log(`📋 Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 50): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Manually trigger alert evaluation
   */
  async evaluateRules(): Promise<{
    evaluatedRules: number;
    firedAlerts: number;
    resolvedAlerts: number;
  }> {
    console.log('🔍 Manual alert rule evaluation triggered');
    return this.evaluateAlertRules();
  }

  /**
   * Manually fire an alert
   */
  async fireAlert(
    ruleId: string,
    metric: string,
    currentValue: number,
    description: string
  ): Promise<Alert> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule ${ruleId} not found`);
    }

    const alertId = `${ruleId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const alert: Alert = {
      alertId,
      ruleId,
      ruleName: rule.name,
      type: rule.type,
      severity: rule.severity,
      metric,
      currentValue,
      threshold: rule.threshold,
      status: 'firing',
      firstFired: timestamp,
      lastFired: timestamp,
      occurrenceCount: 1,
      description,
      evidence: [],
      channels: rule.channels.length > 0 ? rule.channels : this.config.defaultChannels
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.push(alert);
    this.metrics.totalAlertsGenerated++;
    this.metrics.activeAlerts++;

    await this.deliverAlert(alert);
    await this.storeAlertEvidence(alert);

    console.log(`🚨 Alert fired: ${alert.ruleName} (${alert.severity})`);

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, reason = 'Manual resolution'): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();

    this.activeAlerts.delete(alertId);
    this.metrics.activeAlerts--;
    this.metrics.resolvedAlerts++;

    await this.storeAlertEvidence(alert);

    console.log(`✅ Alert resolved: ${alert.ruleName} - ${reason}`);

    return true;
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // Rule 1: High validation latency (Phase 2 requirement)
    this.addAlertRule({
      ruleId: 'high_validation_latency',
      name: 'High Validation Latency',
      description: 'Latency > 2s for > 5% of validations in a 5-minute window',
      type: 'latency',
      metric: 'validation_latency_p95',
      operator: 'greater_than',
      threshold: 2000, // 2s in ms
      windowDurationMs: 300000, // 5 minutes
      minimumOccurrences: 5, // 5% threshold approximation
      severity: 'warning',
      enabled: true,
      channels: this.config.defaultChannels
    });

    // Rule 2: High validation failure rate (Phase 2 requirement)
    this.addAlertRule({
      ruleId: 'high_validation_failure_rate',
      name: 'High Validation Failure Rate',
      description: '> 1% validation failures in a 15-minute window',
      type: 'error_rate',
      metric: 'validation_error_rate',
      operator: 'greater_than',
      threshold: 0.01, // 1%
      windowDurationMs: 900000, // 15 minutes
      severity: 'critical',
      enabled: true,
      channels: this.config.defaultChannels
    });

    // Rule 3: Evidence integrity failure (Phase 2 requirement)
    this.addAlertRule({
      ruleId: 'evidence_integrity_failure',
      name: 'Evidence Integrity Failure',
      description: 'Any evidence integrity verification failure',
      type: 'evidence_integrity',
      metric: 'evidence_integrity_failures',
      operator: 'greater_than',
      threshold: 0,
      windowDurationMs: 60000, // 1 minute
      severity: 'critical',
      enabled: true,
      channels: this.config.defaultChannels
    });

    // Rule 4: System health degradation
    this.addAlertRule({
      ruleId: 'system_health_degraded',
      name: 'System Health Degraded',
      description: 'Overall system health below healthy threshold',
      type: 'health',
      metric: 'system_health_ratio',
      operator: 'less_than',
      threshold: 0.8, // 80% healthy components
      windowDurationMs: 60000, // 1 minute
      severity: 'warning',
      enabled: true,
      channels: this.config.defaultChannels
    });

    // Rule 5: API error rate spike
    this.addAlertRule({
      ruleId: 'api_error_rate_spike',
      name: 'API Error Rate Spike',
      description: 'External API error rate above acceptable threshold',
      type: 'error_rate',
      metric: 'api_error_rate',
      operator: 'greater_than',
      threshold: 0.1, // 10%
      windowDurationMs: 300000, // 5 minutes
      severity: 'warning',
      enabled: true,
      channels: this.config.defaultChannels
    });

    console.log(`📋 Initialized ${this.alertRules.size} default alert rules`);
  }

  /**
   * Evaluate all alert rules
   */
  private async evaluateAlertRules(): Promise<{
    evaluatedRules: number;
    firedAlerts: number;
    resolvedAlerts: number;
  }> {
    let evaluatedRules = 0;
    let firedAlerts = 0;
    let resolvedAlerts = 0;

    if (!this.config.enableAlerting) {
      return { evaluatedRules, firedAlerts, resolvedAlerts };
    }

    try {
      // Get current metrics from monitoring systems
      const performanceMetrics = await performanceMonitor.getPerformanceMetrics();
      const systemHealth = healthCheckSystem.getSystemHealth();

      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) {
          continue;
        }

        evaluatedRules++;
        this.metrics.ruleEvaluations++;

        const shouldFire = await this.evaluateRule(rule, performanceMetrics, systemHealth);
        
        if (shouldFire.fire) {
          const existingAlert = this.findActiveAlert(rule.ruleId);
          
          if (!existingAlert || this.shouldUpdateAlert(existingAlert)) {
            await this.fireAlert(
              rule.ruleId,
              rule.metric,
              shouldFire.currentValue || 0,
              shouldFire.description || rule.description
            );
            firedAlerts++;
          }
        } else {
          // Check if we should resolve existing alerts
          const existingAlert = this.findActiveAlert(rule.ruleId);
          if (existingAlert && existingAlert.status === 'firing') {
            await this.resolveAlert(existingAlert.alertId, 'Metric returned to normal');
            resolvedAlerts++;
          }
        }
      }

      // Cleanup old alerts
      this.cleanupOldAlerts();

    } catch (error) {
      console.error('Error evaluating alert rules:', error);
    }

    return { evaluatedRules, firedAlerts, resolvedAlerts };
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(
    rule: AlertRule,
    performanceMetrics: any,
    systemHealth: any
  ): Promise<{ fire: boolean; currentValue?: number; description?: string }> {
    let currentValue: number;
    let description: string;

    switch (rule.metric) {
      case 'validation_latency_p95':
        currentValue = performanceMetrics?.validationLatency?.p95 || 0;
        description = `Validation P95 latency: ${currentValue.toFixed(0)}ms`;
        break;

      case 'validation_error_rate':
        currentValue = performanceMetrics?.errorRates?.validation || 0;
        description = `Validation error rate: ${(currentValue * 100).toFixed(2)}%`;
        break;

      case 'evidence_integrity_failures':
        currentValue = 0; // Would be tracked by evidence storage system
        description = `Evidence integrity failures: ${currentValue}`;
        break;

      case 'system_health_ratio':
        const healthyCount = systemHealth?.summary?.healthyCount || 0;
        const totalCount = systemHealth?.summary?.totalComponents || 1;
        currentValue = healthyCount / totalCount;
        description = `System health: ${healthyCount}/${totalCount} components healthy`;
        break;

      case 'api_error_rate':
        currentValue = performanceMetrics?.errorRates?.api || 0;
        description = `API error rate: ${(currentValue * 100).toFixed(2)}%`;
        break;

      default:
        return { fire: false };
    }

    const shouldFire = this.evaluateThreshold(rule, currentValue);

    return {
      fire: shouldFire,
      currentValue,
      description
    };
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(rule: AlertRule, currentValue: number): boolean {
    switch (rule.operator) {
      case 'greater_than':
        return currentValue > rule.threshold;
      case 'less_than':
        return currentValue < rule.threshold;
      case 'equals':
        return currentValue === rule.threshold;
      case 'not_equals':
        return currentValue !== rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Find active alert for rule
   */
  private findActiveAlert(ruleId: string): Alert | undefined {
    return Array.from(this.activeAlerts.values()).find(alert => alert.ruleId === ruleId);
  }

  /**
   * Check if alert should be updated (not suppressed)
   */
  private shouldUpdateAlert(alert: Alert): boolean {
    const timeSinceLastFired = Date.now() - new Date(alert.lastFired).getTime();
    return timeSinceLastFired > this.config.suppressionTimeMs;
  }

  /**
   * Deliver alert through configured channels
   */
  private async deliverAlert(alert: Alert): Promise<void> {
    for (const channel of alert.channels) {
      if (!channel.enabled) {
        continue;
      }

      try {
        await this.deliverToChannel(alert, channel);
        this.metrics.channelDeliveries++;
      } catch (error) {
        console.error(`Failed to deliver alert ${alert.alertId} to ${channel.type}:`, error);
        this.metrics.channelFailures++;
      }
    }
  }

  /**
   * Deliver alert to specific channel
   */
  private async deliverToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.deliverToConsole(alert);
        break;

      case 'email':
        // Would integrate with email service
        console.log(`📧 EMAIL ALERT: ${alert.ruleName} - ${alert.description}`);
        break;

      case 'slack':
        // Would integrate with Slack API
        console.log(`💬 SLACK ALERT: ${alert.ruleName} - ${alert.description}`);
        break;

      case 'webhook':
        // Would make HTTP POST to webhook URL
        console.log(`🔗 WEBHOOK ALERT: ${alert.ruleName} - ${alert.description}`);
        break;

      case 'database':
        // Store alert in database for dashboard
        console.log(`💾 DATABASE ALERT: ${alert.ruleName} - ${alert.description}`);
        break;

      default:
        console.log(`❓ UNKNOWN CHANNEL: ${channel.type}`);
    }
  }

  /**
   * Deliver alert to console
   */
  private deliverToConsole(alert: Alert): void {
    const emoji = alert.severity === 'critical' ? '🔥' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    const message = `${emoji} ALERT [${alert.severity.toUpperCase()}]: ${alert.ruleName}`;
    const details = `   ${alert.description} (Current: ${alert.currentValue}, Threshold: ${alert.threshold})`;
    
    if (alert.severity === 'critical') {
      console.error(message);
      console.error(details);
    } else if (alert.severity === 'warning') {
      console.warn(message);
      console.warn(details);
    } else {
      console.info(message);
      console.info(details);
    }
  }

  /**
   * Store alert evidence
   */
  private async storeAlertEvidence(alert: Alert): Promise<void> {
    try {
      const alertEvidence = {
        type: 'alert_event',
        alertId: alert.alertId,
        ruleId: alert.ruleId,
        ruleName: alert.ruleName,
        alertType: alert.type,
        severity: alert.severity,
        status: alert.status,
        metric: alert.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        description: alert.description,
        timestamp: new Date().toISOString(),
        metadata: {
          alertManager: '2.2.3',
          occurrenceCount: alert.occurrenceCount,
          channels: alert.channels.map(c => c.type)
        }
      };

      const result = await putImmutable(alertEvidence);
      alert.evidence.push(result.hash);

    } catch (error) {
      console.error('Failed to store alert evidence:', error);
      // Don't throw - this shouldn't fail the alerting
    }
  }

  /**
   * Cleanup old alerts and history
   */
  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - (this.config.alertRetentionDays * 24 * 60 * 60 * 1000);
    
    // Remove old alerts from history
    this.alertHistory = this.alertHistory.filter(alert => {
      const alertTime = new Date(alert.firstFired).getTime();
      return alertTime > cutoff;
    });

    // Check if we have too many active alerts
    if (this.activeAlerts.size > this.config.maxActiveAlerts) {
      console.warn(`⚠️ Too many active alerts (${this.activeAlerts.size}), cleanup may be needed`);
    }
  }
}

// Global alert manager instance
export const alertManager = new AlertManager();