import { ActorContext } from '../../processing-route/domain/processing-route.types';
import {
  DeliveryPackageView,
  DeliveryRunView,
  DeliveryVehicleView,
  HandoffPhotoView,
  PackageHandoffResult,
  PackageScanOutboundResult,
} from './delivery.types';

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface DeliveryRepository {
  findActiveVehicles(): Promise<DeliveryVehicleView[]>;
  findDeliveryPackages(): Promise<DeliveryPackageView[]>;
  findLoadedPackages(runId: string): Promise<DeliveryPackageView[]>;
  findPackageById(packageId: string): Promise<DeliveryPackageView | null>;
  findActiveRun(staffId: string): Promise<DeliveryRunView | null>;
  findRunById(runId: string): Promise<DeliveryRunView | null>;
  createRun(input: { staffId: string; vehicleCode: string }): Promise<DeliveryRunView>;
  closeRun(runId: string): Promise<DeliveryRunView>;
  /**
   * Count of unresolved (status='WAITING') billing rows for the order.
   * Scan-outbound is allowed only when this is 0 — BASE and every
   * SUPPLEMENT must be PAID/CANCELLED before the package leaves the
   * factory. Replaces the older `findBillingStatus` which only checked
   * BASE and silently allowed unpaid SUPPLEMENTs to slip through.
   */
  countWaitingBillings(orderId: string): Promise<number>;
  scanOutbound(input: { packageId: string; runId: string; actor: ActorContext }): Promise<PackageScanOutboundResult>;
  handoffPackage(input: { packageId: string; actor: ActorContext }): Promise<PackageHandoffResult>;
  recordHandoffPhoto(input: { packageId: string; url: string }): Promise<HandoffPhotoView>;
}
