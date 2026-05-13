import {
  CurrentStateView,
  ProcessEventView,
  RouteView,
  RouteWithStepsView,
} from './processing-route.types';

export const PROCESSING_ROUTE_REPOSITORY = Symbol('PROCESSING_ROUTE_REPOSITORY');

export interface ProcessingRouteRepository {
  findActiveRoutes(): Promise<RouteWithStepsView[]>;
  findRouteByCode(code: string): Promise<RouteWithStepsView | null>;
  findItemProcessing(orderItemId: string): Promise<CurrentStateView | null>;
  findItemProcessEvents(orderItemId: string): Promise<ProcessEventView[]>;
}
