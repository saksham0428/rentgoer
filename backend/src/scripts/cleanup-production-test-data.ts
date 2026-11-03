import dns from 'dns';
// Ensure IPv4 resolution precedence for stable connection to Supabase pooler
dns.setDefaultResultOrder('ipv4first');

import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  loadProductionEnv,
  verifyProductionTarget,
  EXPECTED_PRODUCTION_PROJECT_REF,
} from './verify-production-target';

// Hard-coded protected listings that must NEVER be deleted or modified
export const PROTECTED_PROPERTY_IDS: ReadonlyArray<string> = Object.freeze([
  'b05f8dd2-89c4-4107-bf17-2aea9307af15', // "Kothi for Rana Ji"
  'e69c729b-5165-4cfe-8f84-f494f8668995', // "2BHK"
]);

// Hard-coded protected customer accounts that must NEVER be deleted or modified
export const PROTECTED_USER_EMAILS: ReadonlyArray<string> = Object.freeze([
  'saksham8@gmail.com',
  'arijitpatra@gmail.com',
  'arijitpatra204@gmail.com',
  'sakshamc18@gmail.com',
  'beroorzero@gmail.com',
  'gg@gmail.com',
]);

export const REQUIRED_CONFIRMATION_PHRASE = 'AUTHORIZED_PURGE_126_PROPERTIES';

export interface CleanupInventory {
  candidatePropertyIds: string[];
  candidateOwnerIds: string[];
  candidateTestUserIds: string[];
  candidateRentalRequestIds: string[];
  candidateConversationIds: string[];
  candidateMessageIds: string[];
  candidateVerificationRequestIds: string[];
  candidateReportIds: string[];
  candidateNotificationIds: string[];
}

export interface CleanupResult {
  success: boolean;
  executed: boolean;
  deletedCounts: {
    notifications: number;
    reports: number;
    messages: number;
    conversations: number;
    rentalRequests: number;
    verificationRequests: number;
    properties: number;
    sessions: number;
    syntheticOwners: number;
    otherTestUsers: number;
  };
  remainingPropertyCount: number;
  message: string;
}

/**
 * Loads and validates the approved cleanup inventory.
 */
export function loadApprovedInventory(inventoryJsonPath?: string): CleanupInventory {
  const defaultPath = path.resolve(
    'C:/Users/Saksham/.gemini/antigravity/brain/259710b2-a9df-4ce6-bb26-65ab9ac4fc19/cleanup-candidate-ids.json'
  );
  const targetPath = inventoryJsonPath || defaultPath;
  const fs = require('fs');
  if (!fs.existsSync(targetPath)) {
    throw new Error(`FAIL-CLOSED: Approved cleanup candidate inventory not found at: ${targetPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

  // Notification IDs verified in Phase 5.2
  const candidateNotificationIds: string[] = [
    'e5f10b8b-bd81-47ad-876d-5dcbd6659de1',
    'e126186e-db21-4830-b9b6-22705c89dc3e',
    '39d484e5-7243-49ab-8c9b-b7e79e1f1e68',
    'd26c179a-fe02-4ede-a43c-8febd0542f31',
    '422185d7-85cd-4fbd-a598-3ed4cf0a7508',
    '176fae26-e86a-43e9-b912-abd5f0a61978',
    '4e1d2dca-321c-46d0-8df3-20a2df37e34b',
    '86abc2c2-f6f1-4790-93dd-fe5153cfb01c',
  ];

  return {
    candidatePropertyIds: raw.candidatePropertyIds,
    candidateOwnerIds: raw.candidateOwnerIds,
    candidateTestUserIds: raw.candidateTestUserIds,
    candidateRentalRequestIds: raw.candidateRentalRequestIds,
    candidateConversationIds: raw.candidateConversationIds,
    candidateMessageIds: raw.candidateMessageIds,
    candidateVerificationRequestIds: raw.candidateVerificationRequestIds,
    candidateReportIds: raw.candidateReportIds,
    candidateNotificationIds,
  };
}

/**
 * Prepares and conditionally executes the atomic production test data cleanup.
 *
 * FAILS-CLOSED:
 * 1. Requires exact production project ref 'qgqwrxttgdnconrqfspb'.
 * 2. Requires process.env.CONFIRM_PRODUCTION_CLEANUP === 'AUTHORIZED_PURGE_126_PROPERTIES'.
 * 3. Requires CLI argument '--confirm'.
 * 4. Strictly protects the 2 legitimate properties and all legitimate customer accounts.
 * 5. Runs strictly within a database transaction with post-mutation assertions.
 */
export async function executeProductionTestCleanup(options?: {
  inventoryJsonPath?: string;
  isAuthorized?: boolean;
}): Promise<CleanupResult> {
  console.log('[CLEANUP GUARD] Initializing safety verification...');

  // 1. Verify production environment and target
  loadProductionEnv();
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl || !directUrl.includes(EXPECTED_PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `CRITICAL SAFETY ABORT: DIRECT_URL does not target production project ref '${EXPECTED_PRODUCTION_PROJECT_REF}'`
    );
  }

  // 2. Run target guard
  const targetVerification = await verifyProductionTarget();
  if (!targetVerification.verified) {
    throw new Error('CRITICAL SAFETY ABORT: verifyProductionTarget failed.');
  }

  // 3. Load approved candidate inventory
  const inventory = loadApprovedInventory(options?.inventoryJsonPath);

  console.log('[CLEANUP GUARD] Approved Inventory Counts:');
  console.log(`- Candidate Properties          : ${inventory.candidatePropertyIds.length} (expected 126)`);
  console.log(`- Candidate Synthetic Owners    : ${inventory.candidateOwnerIds.length} (expected 66)`);
  console.log(`- Other Candidate Test Users    : ${inventory.candidateTestUserIds.length} (expected 26)`);
  console.log(`- Candidate Rental Requests     : ${inventory.candidateRentalRequestIds.length} (expected 25)`);
  console.log(`- Candidate Conversations       : ${inventory.candidateConversationIds.length} (expected 11)`);
  console.log(`- Candidate Messages            : ${inventory.candidateMessageIds.length} (expected 5)`);
  console.log(`- Candidate Verification Reqs   : ${inventory.candidateVerificationRequestIds.length} (expected 3)`);
  console.log(`- Candidate Reports             : ${inventory.candidateReportIds.length} (expected 2)`);
  console.log(`- Candidate Notifications       : ${inventory.candidateNotificationIds.length} (expected 8)`);

  // Assertion: Inventory counts must match approved Phase 5.2 baseline exactly
  if (
    inventory.candidatePropertyIds.length !== 126 ||
    inventory.candidateOwnerIds.length !== 66 ||
    inventory.candidateTestUserIds.length !== 26 ||
    inventory.candidateRentalRequestIds.length !== 25 ||
    inventory.candidateConversationIds.length !== 11 ||
    inventory.candidateMessageIds.length !== 5 ||
    inventory.candidateVerificationRequestIds.length !== 3 ||
    inventory.candidateReportIds.length !== 2 ||
    inventory.candidateNotificationIds.length !== 8
  ) {
    throw new Error('SAFETY ABORT: Candidate inventory counts do not match approved Phase 5.2 specification.');
  }

  // 4. Assert no intersection with protected entities
  for (const pid of inventory.candidatePropertyIds) {
    if (PROTECTED_PROPERTY_IDS.includes(pid)) {
      throw new Error(`CRITICAL COLLISION: Protected property ID '${pid}' found in deletion candidate list!`);
    }
  }

  // 5. Connect via PrismaClient
  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });

  try {
    // 6. Pre-flight verification against live database
    console.log('[CLEANUP GUARD] Running pre-flight database assertions...');

    // A. Verify protected listings exist
    const protectedProps = await prisma.property.findMany({
      where: { id: { in: [...PROTECTED_PROPERTY_IDS] } },
      include: { owner: true, images: true, rentalRequests: true, favorites: true },
    });

    if (protectedProps.length !== 2) {
      throw new Error(
        `SAFETY ABORT: Expected exactly 2 protected listings in DB, found ${protectedProps.length}`
      );
    }

    for (const pp of protectedProps) {
      if (pp.owner.email !== 'saksham8@gmail.com') {
        throw new Error(`SAFETY ABORT: Protected listing '${pp.id}' owner email is '${pp.owner.email}', expected 'saksham8@gmail.com'`);
      }
      if (pp.images.length === 0) {
        throw new Error(`SAFETY ABORT: Protected listing '${pp.id}' has 0 images!`);
      }
    }

    // B. Verify candidate properties exist and belong only to candidate owners
    const liveCandidateProps = await prisma.property.findMany({
      where: { id: { in: inventory.candidatePropertyIds } },
      select: { id: true, ownerId: true, owner: { select: { email: true } } },
    });

    if (liveCandidateProps.length !== 126) {
      throw new Error(
        `SAFETY ABORT: Expected 126 live candidate properties, found ${liveCandidateProps.length}`
      );
    }

    for (const cp of liveCandidateProps) {
      if (PROTECTED_PROPERTY_IDS.includes(cp.id)) {
        throw new Error(`CRITICAL COLLISION: Protected property '${cp.id}' matched candidate list.`);
      }
      if (PROTECTED_USER_EMAILS.includes(cp.owner.email.toLowerCase())) {
        throw new Error(
          `CRITICAL COLLISION: Candidate property '${cp.id}' belongs to protected user '${cp.owner.email}'.`
        );
      }
    }

    // C. Verify candidate owners exist and are synthetic
    const liveCandidateOwners = await prisma.user.findMany({
      where: { id: { in: inventory.candidateOwnerIds } },
      select: { id: true, email: true },
    });

    if (liveCandidateOwners.length !== 66) {
      throw new Error(
        `SAFETY ABORT: Expected 66 live candidate owners, found ${liveCandidateOwners.length}`
      );
    }

    for (const co of liveCandidateOwners) {
      if (PROTECTED_USER_EMAILS.includes(co.email.toLowerCase())) {
        throw new Error(`CRITICAL COLLISION: Candidate owner '${co.email}' is a protected customer!`);
      }
    }

    // D. Verify candidate test non-owners exist and are synthetic
    const liveCandidateTestUsers = await prisma.user.findMany({
      where: { id: { in: inventory.candidateTestUserIds } },
      select: { id: true, email: true },
    });

    if (liveCandidateTestUsers.length !== 26) {
      throw new Error(
        `SAFETY ABORT: Expected 26 live candidate test users, found ${liveCandidateTestUsers.length}`
      );
    }

    for (const ctu of liveCandidateTestUsers) {
      if (PROTECTED_USER_EMAILS.includes(ctu.email.toLowerCase())) {
        throw new Error(`CRITICAL COLLISION: Candidate user '${ctu.email}' is a protected customer!`);
      }
    }

    console.log('[CLEANUP GUARD] Pre-flight assertions PASSED. Target database matches approved inventory.');

    // 7. Check authorization flags
    const hasCliConfirm = process.argv.includes('--confirm');
    const hasEnvConfirm = process.env.CONFIRM_PRODUCTION_CLEANUP === REQUIRED_CONFIRMATION_PHRASE;
    const isExplicitlyAuthorized = Boolean(options?.isAuthorized && hasCliConfirm && hasEnvConfirm);

    if (!isExplicitlyAuthorized) {
      console.log('\n======================================================');
      console.log('[DRY-RUN COMPLETE] Zero records deleted or modified.');
      console.log('To execute this cleanup in a future authorized phase, run:');
      console.log('  CONFIRM_PRODUCTION_CLEANUP="AUTHORIZED_PURGE_126_PROPERTIES" npx tsx src/scripts/cleanup-production-test-data.ts --confirm');
      console.log('======================================================\n');

      return {
        success: true,
        executed: false,
        deletedCounts: {
          notifications: 0,
          reports: 0,
          messages: 0,
          conversations: 0,
          rentalRequests: 0,
          verificationRequests: 0,
          properties: 0,
          sessions: 0,
          syntheticOwners: 0,
          otherTestUsers: 0,
        },
        remainingPropertyCount: 128,
        message: 'DRY-RUN VALIDATION SUCCESSFUL. Deletion aborted as designed (awaiting user authorization).',
      };
    }

    // 8. ATOMIC DELETION TRANSACTION (Only executed when explicitly authorized)
    console.log('\n[PRODUCTION CLEANUP] Starting atomic deletion transaction...');

    const result = await prisma.$transaction(
      async (tx) => {
        // Step 1: Notifications
        const delNotifs = await tx.notification.deleteMany({
          where: { id: { in: inventory.candidateNotificationIds } },
        });
        if (delNotifs.count !== 8) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delNotifs.count} notifications, expected 8.`);
        }

        // Step 2: Reports
        const delReports = await tx.report.deleteMany({
          where: { id: { in: inventory.candidateReportIds } },
        });
        if (delReports.count !== 2) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delReports.count} reports, expected 2.`);
        }

        // Step 3: Messages
        const delMessages = await tx.message.deleteMany({
          where: { id: { in: inventory.candidateMessageIds } },
        });
        if (delMessages.count !== 5) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delMessages.count} messages, expected 5.`);
        }

        // Step 4: Conversations
        const delConvs = await tx.conversation.deleteMany({
          where: { id: { in: inventory.candidateConversationIds } },
        });
        if (delConvs.count !== 11) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delConvs.count} conversations, expected 11.`);
        }

        // Step 5: Rental Requests
        const delReqs = await tx.rentalRequest.deleteMany({
          where: { id: { in: inventory.candidateRentalRequestIds } },
        });
        if (delReqs.count !== 25) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delReqs.count} rental requests, expected 25.`);
        }

        // Step 6: Verification Requests
        const delVerifs = await tx.verificationRequest.deleteMany({
          where: { id: { in: inventory.candidateVerificationRequestIds } },
        });
        if (delVerifs.count !== 3) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delVerifs.count} verification requests, expected 3.`);
        }

        // Step 7: Properties (126 test listings)
        const delProps = await tx.property.deleteMany({
          where: { id: { in: inventory.candidatePropertyIds } },
        });
        if (delProps.count !== 126) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delProps.count} properties, expected 126.`);
        }

        // Step 8: Sessions of candidate users
        const allCandidateUserIds = [
          ...inventory.candidateOwnerIds,
          ...inventory.candidateTestUserIds,
        ];
        const delSessions = await tx.session.deleteMany({
          where: { userId: { in: allCandidateUserIds } },
        });

        // Step 9: Synthetic Owner Accounts (66)
        const delOwners = await tx.user.deleteMany({
          where: { id: { in: inventory.candidateOwnerIds } },
        });
        if (delOwners.count !== 66) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delOwners.count} owners, expected 66.`);
        }

        // Step 10: Other Test Users (26)
        const delOtherUsers = await tx.user.deleteMany({
          where: { id: { in: inventory.candidateTestUserIds } },
        });
        if (delOtherUsers.count !== 26) {
          throw new Error(`TRANSACTION ABORT: Deleted ${delOtherUsers.count} test users, expected 26.`);
        }

        // Post-mutation safety verification within transaction
        const remainingPropsCount = await tx.property.count();
        if (remainingPropsCount !== 2) {
          throw new Error(
            `TRANSACTION ABORT: Expected exactly 2 properties remaining in DB, found ${remainingPropsCount}.`
          );
        }

        const remainingProtected = await tx.property.findMany({
          where: { id: { in: [...PROTECTED_PROPERTY_IDS] } },
        });
        if (remainingProtected.length !== 2) {
          throw new Error('TRANSACTION ABORT: Protected listings verification failed after deletion.');
        }

        // Verify protected accounts remain intact
        const remainingProtectedUsers = await tx.user.findMany({
          where: { email: { in: [...PROTECTED_USER_EMAILS] } },
        });
        if (remainingProtectedUsers.length === 0) {
          throw new Error('TRANSACTION ABORT: Protected user accounts missing after deletion.');
        }

        return {
          deletedCounts: {
            notifications: delNotifs.count,
            reports: delReports.count,
            messages: delMessages.count,
            conversations: delConvs.count,
            rentalRequests: delReqs.count,
            verificationRequests: delVerifs.count,
            properties: delProps.count,
            sessions: delSessions.count,
            syntheticOwners: delOwners.count,
            otherTestUsers: delOtherUsers.count,
          },
          remainingPropertyCount: remainingPropsCount,
        };
      },
      { timeout: 60000, maxWait: 10000 }
    );

    console.log('[PRODUCTION CLEANUP] Transaction committed successfully.');
    console.log(`Remaining properties in production: ${result.remainingPropertyCount} (strictly genuine).`);

    return {
      success: true,
      executed: true,
      deletedCounts: result.deletedCounts,
      remainingPropertyCount: result.remainingPropertyCount,
      message: 'AUTHORIZED PRODUCTION CLEANUP EXECUTED SUCCESSFULLY.',
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Direct execution entrypoint
if (require.main === module) {
  executeProductionTestCleanup()
    .then((res) => {
      console.log('Result:', res.message);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[CLEANUP ERROR]:', err.message);
      process.exit(1);
    });
}

