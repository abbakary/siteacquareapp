import { UserRole } from '../types/aquaculture';

export interface RolePermissions {
  canRecordFeeding: boolean;
  canApproveFeedingPlan: boolean;
  canIssueFeedFromStore: boolean;
  canReportMortality: boolean;
  canDeleteMortality: boolean; // Always false — no silent deletion!
  canVerifyMortality: boolean;
  canRecordWaterQuality: boolean;
  canRecommendTreatment: boolean;
  canApproveTreatment: boolean;
  canRequestTransfer: boolean;
  canApproveTransfer: boolean;
  canApproveHarvest: boolean;
  canRecordSale: boolean;
  canOverrideSalePrice: boolean;
  canManageCustomers: boolean;
  canViewFullFinance: boolean;
  canManageEmployees: boolean;
}

export const ROLE_MATRIX: Record<UserRole, RolePermissions> = {
  owner: {
    canRecordFeeding: false,
    canApproveFeedingPlan: true,
    canIssueFeedFromStore: false,
    canReportMortality: false,
    canDeleteMortality: false,
    canVerifyMortality: false,
    canRecordWaterQuality: true,
    canRecommendTreatment: false,
    canApproveTreatment: true,
    canRequestTransfer: true,
    canApproveTransfer: true,
    canApproveHarvest: true,
    canRecordSale: true,
    canOverrideSalePrice: true,
    canManageCustomers: true,
    canViewFullFinance: true,
    canManageEmployees: true,
  },
  manager: {
    canRecordFeeding: true,
    canApproveFeedingPlan: true,
    canIssueFeedFromStore: false,
    canReportMortality: true,
    canDeleteMortality: false,
    canVerifyMortality: true,
    canRecordWaterQuality: true,
    canRecommendTreatment: true,
    canApproveTreatment: true,
    canRequestTransfer: true,
    canApproveTransfer: true,
    canApproveHarvest: true,
    canRecordSale: true,
    canOverrideSalePrice: true,
    canManageCustomers: true,
    canViewFullFinance: true,
    canManageEmployees: true,
  },
  technician: {
    canRecordFeeding: false,
    canApproveFeedingPlan: false,
    canIssueFeedFromStore: false,
    canReportMortality: true,
    canDeleteMortality: false,
    canVerifyMortality: true,
    canRecordWaterQuality: true,
    canRecommendTreatment: true,
    canApproveTreatment: false,
    canRequestTransfer: true,
    canApproveTransfer: false,
    canApproveHarvest: false,
    canRecordSale: false,
    canOverrideSalePrice: false,
    canManageCustomers: false,
    canViewFullFinance: false,
    canManageEmployees: false,
  },
  keeper: {
    canRecordFeeding: true,
    canApproveFeedingPlan: false,
    canIssueFeedFromStore: false,
    canReportMortality: true,
    canDeleteMortality: false,
    canVerifyMortality: false,
    canRecordWaterQuality: true,
    canRecommendTreatment: false,
    canApproveTreatment: false,
    canRequestTransfer: true,
    canApproveTransfer: false,
    canApproveHarvest: false,
    canRecordSale: true,
    canOverrideSalePrice: false,
    canManageCustomers: false,
    canViewFullFinance: false,
    canManageEmployees: false,
  },
  storekeeper: {
    canRecordFeeding: false,
    canApproveFeedingPlan: false,
    canIssueFeedFromStore: true,
    canReportMortality: false,
    canDeleteMortality: false,
    canVerifyMortality: false,
    canRecordWaterQuality: false,
    canRecommendTreatment: false,
    canApproveTreatment: false,
    canRequestTransfer: false,
    canApproveTransfer: false,
    canApproveHarvest: false,
    canRecordSale: true,
    canOverrideSalePrice: false,
    canManageCustomers: true,
    canViewFullFinance: false,
    canManageEmployees: false,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_MATRIX[role];
}
