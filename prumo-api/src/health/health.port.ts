export interface HealthStatus {
  status: 'ok';
}

export interface HealthCheck {
  check(): HealthStatus;
}

export const HEALTH_CHECK = Symbol('HEALTH_CHECK');
