import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const ADMIN_UID = 'admin-uid';
const CLIENT_UID = 'client-uid';
const OTHER_CLIENT_UID = 'other-client-uid';
/** Supervises fund1 only. */
const MANAGER_UID = 'manager-uid';

function adminDb() {
  return testEnv.authenticatedContext(ADMIN_UID, { role: 'superAdmin' }).firestore();
}
function clientDb() {
  return testEnv.authenticatedContext(CLIENT_UID, { role: 'client' }).firestore();
}
function otherClientDb() {
  return testEnv.authenticatedContext(OTHER_CLIENT_UID, { role: 'client' }).firestore();
}
function managerDb() {
  return testEnv.authenticatedContext(MANAGER_UID, { role: 'fundManager' }).firestore();
}
/** A guest on the public donation screen - no account at all. */
function guestDb() {
  return testEnv.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-kupat-tzedaka-rules',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed baseline data with rules disabled.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'funds/fund1'), {
      name: 'קרן מעשרות',
      category: 'donation',
      keywords: ['מעשר'],
      balance: 1000,
      currency: 'ILS',
      active: true,
      createdBy: ADMIN_UID,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'funds/fund1/ledger/entry1'), {
      fundId: 'fund1',
      type: 'donationIn',
      amount: 1000,
      balanceAfter: 1000,
      createdBy: ADMIN_UID,
      createdAt: Date.now(),
    });
    // fund2 exists purely to prove a supervisor cannot see beyond their scope.
    await setDoc(doc(db, 'funds/fund2'), {
      name: 'קרן אחרת',
      category: 'donation',
      isGeneralFund: false,
      keywords: [],
      balance: 500,
      currency: 'ILS',
      active: true,
      createdBy: ADMIN_UID,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'funds/fund2/ledger/entry1'), {
      fundId: 'fund2',
      type: 'donationIn',
      amount: 500,
      balanceAfter: 500,
      createdBy: ADMIN_UID,
      createdAt: Date.now(),
    });
    await setDoc(doc(db, 'users/' + MANAGER_UID), {
      role: 'fundManager',
      username: 'manager1',
      fullName: 'מנהל קרן',
      fundIds: ['fund1'],
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'orgSettings/main'), {
      orgName: 'ישיבה לדוגמה',
      orgNumber: '580000000',
      section46CertNumber: '12345',
      commissionPercentage: 5,
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'auditLog/audit1'), {
      adminId: ADMIN_UID,
      action: 'donation.confirm',
      entity: 'donation',
      entityId: 'don-x',
      fundId: 'fund1',
      timestamp: Date.now(),
    });
    await setDoc(doc(db, 'auditLog/audit2'), {
      adminId: ADMIN_UID,
      action: 'donation.confirm',
      entity: 'donation',
      entityId: 'don-y',
      fundId: 'fund2',
      timestamp: Date.now(),
    });
    await setDoc(doc(db, 'users/' + CLIENT_UID), {
      role: 'client',
      username: 'client1',
      fullName: 'לקוח בדיקה',
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'people/person1'), {
      fullName: 'תורם',
      searchName: 'תורם',
      isDonor: true,
      isBeneficiary: false,
      totalDonated: 0,
      totalReceived: 0,
      createdAt: Date.now(),
    });
    // Deliberately both roles - the merge case the unified card exists for.
    await setDoc(doc(db, 'people/person2'), {
      fullName: 'נתמך',
      searchName: 'נתמך',
      isDonor: true,
      isBeneficiary: true,
      totalDonated: 100,
      totalReceived: 0,
      createdAt: Date.now(),
    });
    await setDoc(doc(db, 'supportRequests/req1'), {
      type: 'support',
      clientUserId: CLIENT_UID,
      fundId: 'fund1',
      requestedAmount: 500,
      reason: 'סיבה כלשהי לבקשה',
      status: 'pending',
      createdAt: Date.now(),
    });
    await setDoc(doc(db, 'importedFiles/file1'), {
      fileName: 'x.csv',
      storagePath: 'imports/a/x.csv',
      sourceType: 'bankCsv',
      uploadedBy: ADMIN_UID,
      uploadedAt: Date.now(),
      status: 'parsed',
    });
  });
});

describe('funds', () => {
  test('any signed-in user can read funds', async () => {
    await assertSucceeds(getDoc(doc(clientDb(), 'funds/fund1')));
  });

  test('client cannot create a fund', async () => {
    await assertFails(
      addDoc(collection(clientDb(), 'funds'), { name: 'קרן מזויפת', balance: 0, active: true })
    );
  });

  test('admin can edit fund metadata', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'funds/fund1'), { name: 'שם חדש' }));
  });

  test('admin CANNOT write balance directly', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'funds/fund1'), { balance: 999999 }));
  });

  test('client cannot write balance directly', async () => {
    await assertFails(updateDoc(doc(clientDb(), 'funds/fund1'), { balance: 999999 }));
  });

  test('nobody can delete a fund', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'funds/fund1')));
  });
});

describe('ledger', () => {
  test('admin can read ledger', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'funds/fund1/ledger/entry1')));
  });

  test('client cannot read ledger', async () => {
    await assertFails(getDoc(doc(clientDb(), 'funds/fund1/ledger/entry1')));
  });

  test('admin cannot write ledger entries directly', async () => {
    await assertFails(
      addDoc(collection(adminDb(), 'funds/fund1/ledger'), {
        type: 'donationIn',
        amount: 500,
        balanceAfter: 1500,
      })
    );
  });
});

describe('donations', () => {
  test('client can create their own pledge', async () => {
    await assertSucceeds(
      addDoc(collection(clientDb(), 'donations'), {
        fundId: 'fund1',
        personId: null,
        clientUserId: CLIENT_UID,
        grossAmount: 100,
        netAmount: 100,
        feeAmount: 0,
        source: 'clientPledge',
        status: 'pledged',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot create a pledge on behalf of someone else', async () => {
    await assertFails(
      addDoc(collection(clientDb(), 'donations'), {
        fundId: 'fund1',
        personId: null,
        clientUserId: OTHER_CLIENT_UID,
        grossAmount: 100,
        netAmount: 100,
        feeAmount: 0,
        source: 'clientPledge',
        status: 'pledged',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot self-assign a commission split', async () => {
    await assertFails(
      addDoc(collection(clientDb(), 'donations'), {
        fundId: 'fund1',
        personId: null,
        clientUserId: CLIENT_UID,
        grossAmount: 100,
        netAmount: 95,
        feeAmount: 5,
        source: 'clientPledge',
        status: 'pledged',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot fabricate a confirmed bank donation', async () => {
    await assertFails(
      addDoc(collection(clientDb(), 'donations'), {
        fundId: 'fund1',
        personId: null,
        clientUserId: CLIENT_UID,
        amount: 100000,
        source: 'bankImport',
        status: 'confirmed',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot update a donation', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'donations/don1'), {
        fundId: 'fund1',
        clientUserId: CLIENT_UID,
        amount: 100,
        source: 'clientPledge',
        status: 'pledged',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      });
    });
    await assertFails(updateDoc(doc(clientDb(), 'donations/don1'), { status: 'confirmed' }));
  });

  test('client can read their own pledge but not another client\'s', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'donations/don2'), {
        fundId: 'fund1',
        clientUserId: OTHER_CLIENT_UID,
        amount: 100,
        source: 'clientPledge',
        status: 'pledged',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      });
    });
    await assertSucceeds(getDoc(doc(otherClientDb(), 'donations/don2')));
    await assertFails(getDoc(doc(clientDb(), 'donations/don2')));
  });
});

// Guests donate through the createGuestDonation callable, which validates the
// payload server-side. Direct Firestore access must stay shut so the callable
// is the only way in (spec §6.1).
describe('guest (unauthenticated)', () => {
  test('cannot write a donation directly', async () => {
    await assertFails(
      addDoc(collection(guestDb(), 'donations'), {
        fundId: 'fund1',
        personId: null,
        grossAmount: 100,
        netAmount: 100,
        feeAmount: 0,
        source: 'nedarimPlus',
        status: 'pledged',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      })
    );
  });

  test('cannot create a person record directly', async () => {
    await assertFails(
      addDoc(collection(guestDb(), 'people'), {
        fullName: 'אורח',
        searchName: 'אורח',
        isDonor: true,
        isBeneficiary: false,
        totalDonated: 0,
        totalReceived: 0,
        createdAt: Date.now(),
      })
    );
  });

  test('cannot read funds directly - balances stay private', async () => {
    await assertFails(getDoc(doc(guestDb(), 'funds/fund1')));
  });

  test('cannot read donations, people or the audit log', async () => {
    await assertFails(getDoc(doc(guestDb(), 'people/person1')));
    await assertFails(getDoc(doc(guestDb(), 'auditLog/audit1')));
    await assertFails(getDoc(doc(guestDb(), 'orgSettings/main')));
  });
});

describe('supportRequests', () => {
  test('client can create their own pending request', async () => {
    await assertSucceeds(
      addDoc(collection(clientDb(), 'supportRequests'), {
        type: 'support',
        clientUserId: CLIENT_UID,
        fundId: 'fund1',
        requestedAmount: 300,
        reason: 'נימוק מספיק ארוך',
        status: 'pending',
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot create a pre-approved request', async () => {
    await assertFails(
      addDoc(collection(clientDb(), 'supportRequests'), {
        type: 'support',
        clientUserId: CLIENT_UID,
        fundId: 'fund1',
        requestedAmount: 300,
        approvedAmount: 300,
        reason: 'נימוק מספיק ארוך',
        status: 'approved',
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot approve their own request', async () => {
    await assertFails(updateDoc(doc(clientDb(), 'supportRequests/req1'), { status: 'approved' }));
  });

  test('admin can approve a request', async () => {
    await assertSucceeds(
      updateDoc(doc(adminDb(), 'supportRequests/req1'), { status: 'approved', approvedAmount: 500 })
    );
  });

  test('another client cannot read someone else\'s request', async () => {
    await assertFails(getDoc(doc(otherClientDb(), 'supportRequests/req1')));
  });

  test('owner can read their own request', async () => {
    await assertSucceeds(getDoc(doc(clientDb(), 'supportRequests/req1')));
  });
});

// Spec §3/§4.5: the fund manager is a supervisory role. It must be able to see
// everything about its own funds and be unable to change anything, anywhere.
describe('fundManager (supervisor)', () => {
  test('can read the ledger of a fund they supervise', async () => {
    await assertSucceeds(getDoc(doc(managerDb(), 'funds/fund1/ledger/entry1')));
  });

  test('CANNOT read the ledger of a fund they do not supervise', async () => {
    await assertFails(getDoc(doc(managerDb(), 'funds/fund2/ledger/entry1')));
  });

  test('can read donations of their fund', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'donations/donF1'), {
        fundId: 'fund1',
        grossAmount: 200,
        netAmount: 190,
        feeAmount: 10,
        source: 'nedarimPlus',
        status: 'confirmed',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      });
    });
    await assertSucceeds(getDoc(doc(managerDb(), 'donations/donF1')));
  });

  test('CANNOT read donations of another fund', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'donations/donF2'), {
        fundId: 'fund2',
        grossAmount: 200,
        netAmount: 200,
        feeAmount: 0,
        source: 'bankImport',
        status: 'confirmed',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      });
    });
    await assertFails(getDoc(doc(managerDb(), 'donations/donF2')));
  });

  test('can read support requests of their fund', async () => {
    await assertSucceeds(getDoc(doc(managerDb(), 'supportRequests/req1')));
  });

  test('CANNOT approve a support request', async () => {
    await assertFails(
      updateDoc(doc(managerDb(), 'supportRequests/req1'), { status: 'approved', approvedAmount: 500 })
    );
  });

  test('CANNOT edit a fund', async () => {
    await assertFails(updateDoc(doc(managerDb(), 'funds/fund1'), { name: 'שינוי אסור' }));
  });

  test('CANNOT create a fund', async () => {
    await assertFails(
      addDoc(collection(managerDb(), 'funds'), { name: 'קרן חדשה', balance: 0, active: true })
    );
  });

  test('CANNOT write a fund balance', async () => {
    await assertFails(updateDoc(doc(managerDb(), 'funds/fund1'), { balance: 999999 }));
  });

  test('CANNOT confirm a donation', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'donations/donPending'), {
        fundId: 'fund1',
        grossAmount: 100,
        netAmount: 100,
        feeAmount: 0,
        source: 'bankImport',
        status: 'pendingMatch',
        transactionDate: Date.now(),
        createdAt: Date.now(),
      });
    });
    await assertFails(updateDoc(doc(managerDb(), 'donations/donPending'), { status: 'confirmed' }));
  });

  test('CANNOT grant themselves more funds', async () => {
    await assertFails(
      updateDoc(doc(managerDb(), 'users/' + MANAGER_UID), { fundIds: ['fund1', 'fund2'] })
    );
  });

  test('CANNOT escalate their own role', async () => {
    await assertFails(updateDoc(doc(managerDb(), 'users/' + MANAGER_UID), { role: 'superAdmin' }));
  });

  test('CANNOT read donors or beneficiaries (cross-fund personal data)', async () => {
    await assertFails(getDoc(doc(managerDb(), 'people/person1')));
    await assertFails(getDoc(doc(managerDb(), 'people/person2')));
  });

  test('CANNOT read imported files', async () => {
    await assertFails(getDoc(doc(managerDb(), 'importedFiles/file1')));
  });

  test('can read the audit log of their fund but not of another', async () => {
    await assertSucceeds(getDoc(doc(managerDb(), 'auditLog/audit1')));
    await assertFails(getDoc(doc(managerDb(), 'auditLog/audit2')));
  });

  test('CANNOT write to the audit log', async () => {
    await assertFails(
      addDoc(collection(managerDb(), 'auditLog'), {
        adminId: MANAGER_UID,
        action: 'forged',
        entity: 'x',
        entityId: 'y',
        fundId: 'fund1',
        timestamp: Date.now(),
      })
    );
  });

  test('can read org settings but not write them', async () => {
    await assertSucceeds(getDoc(doc(managerDb(), 'orgSettings/main')));
    await assertFails(updateDoc(doc(managerDb(), 'orgSettings/main'), { commissionPercentage: 0 }));
  });
});

describe('orgSettings', () => {
  test('client cannot read org settings', async () => {
    await assertFails(getDoc(doc(clientDb(), 'orgSettings/main')));
  });

  test('even super admin cannot write org settings directly (must use callable)', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'orgSettings/main'), { commissionPercentage: 50 }));
  });
});

// The sync cursor decides which donations get imported, so a client that could
// rewrite it could silently skip or duplicate real money.
describe('integrations (Nedarim Plus sync state)', () => {
  test('super admin can read it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'integrations/nedarimPlus'), {
        lastTransactionId: '5000',
        lastSyncAt: Date.now(),
      });
    });
    await assertSucceeds(getDoc(doc(adminDb(), 'integrations/nedarimPlus')));
  });

  test('nobody can write the cursor directly - not even the super admin', async () => {
    await assertFails(
      setDoc(doc(adminDb(), 'integrations/nedarimPlus'), { lastTransactionId: '0' })
    );
  });

  test('clients and fund managers cannot read it', async () => {
    await assertFails(getDoc(doc(clientDb(), 'integrations/nedarimPlus')));
    await assertFails(getDoc(doc(managerDb(), 'integrations/nedarimPlus')));
  });
});

describe('auditLog', () => {
  test('super admin can read, nobody can write', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'auditLog/audit1')));
    await assertFails(
      addDoc(collection(adminDb(), 'auditLog'), {
        adminId: ADMIN_UID,
        action: 'forged',
        entity: 'x',
        entityId: 'y',
        timestamp: Date.now(),
      })
    );
  });

  test('client cannot read the audit log', async () => {
    await assertFails(getDoc(doc(clientDb(), 'auditLog/audit1')));
  });
});

describe('users', () => {
  test('client cannot escalate their own role', async () => {
    await assertFails(updateDoc(doc(clientDb(), 'users/' + CLIENT_UID), { role: 'superAdmin' }));
  });

  test('client can update their own profile fields', async () => {
    await assertSucceeds(
      updateDoc(doc(clientDb(), 'users/' + CLIENT_UID), { phone: '0500000000' })
    );
  });

  test('client cannot read another user profile', async () => {
    await assertFails(getDoc(doc(otherClientDb(), 'users/' + CLIENT_UID)));
  });
});

describe('people / imports', () => {
  test('client cannot read people', async () => {
    await assertFails(getDoc(doc(clientDb(), 'people/person1')));
  });

  test('client cannot write people', async () => {
    await assertFails(updateDoc(doc(clientDb(), 'people/person2'), { totalReceived: 99999 }));
  });

  test('admin can manage people', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'people/person1'), { phone: '0501111111' }));
    await assertSucceeds(updateDoc(doc(adminDb(), 'people/person2'), { phone: '0502222222' }));
  });

  test('even admin cannot edit money totals directly - only the ledger may', async () => {
    await assertFails(updateDoc(doc(adminDb(), 'people/person1'), { totalDonated: 999999 }));
    await assertFails(updateDoc(doc(adminDb(), 'people/person2'), { totalReceived: 999999 }));
  });

  test('a new person must start with zero totals', async () => {
    await assertFails(
      addDoc(collection(adminDb(), 'people'), {
        fullName: 'מזויף',
        searchName: 'מזויף',
        isDonor: true,
        isBeneficiary: false,
        totalDonated: 50000,
        totalReceived: 0,
        createdAt: Date.now(),
      })
    );
    await assertSucceeds(
      addDoc(collection(adminDb(), 'people'), {
        fullName: 'אדם חדש',
        searchName: 'אדם חדש',
        isDonor: true,
        isBeneficiary: false,
        totalDonated: 0,
        totalReceived: 0,
        createdAt: Date.now(),
      })
    );
  });

  test('client cannot read imported files', async () => {
    await assertFails(getDoc(doc(clientDb(), 'importedFiles/file1')));
  });

  test('admin can read imported files', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'importedFiles/file1')));
  });

  test('usernames collection is fully locked to clients', async () => {
    await assertFails(getDoc(doc(clientDb(), 'usernames/client1')));
    await assertFails(setDoc(doc(clientDb(), 'usernames/hacker'), { uid: CLIENT_UID }));
  });
});
