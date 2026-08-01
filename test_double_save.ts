import { entityService } from './packages/web/src/server/db';
import { pgExecutor } from './packages/web/src/server/db';

async function main() {
  try {
    const entityId = '10000000-0000-0000-0000-000000000001'; // Try to find a valid customer ID or create one
    // First, let's create a customer entity
    const e = await entityService.createEntity({
      actorUserId: '00000000-0000-0000-0000-000000000001',
      parentNodeId: '00000000-0000-0000-0000-000000000001',
      entityTypeKey: 'customer-info',
      name: 'Test Customer',
      description: 'Test',
      payload: { email: 'a@a.com', phone: '123' }
    });
    console.log('Created:', e.id, 'rowVersion:', e.rowVersion);

    // First save
    const e2 = await entityService.updateEntity({
      actorUserId: '00000000-0000-0000-0000-000000000001',
      entityId: e.id,
      name: 'Test Customer 2',
      description: 'Test 2',
      expectedRowVersion: e.rowVersion,
      payloadDelta: { email: 'b@b.com' }
    });
    console.log('Update 1:', e2.id, 'rowVersion:', e2.rowVersion);

    // Second save
    const e3 = await entityService.updateEntity({
      actorUserId: '00000000-0000-0000-0000-000000000001',
      entityId: e2.id,
      name: 'Test Customer 3',
      description: 'Test 3',
      expectedRowVersion: e2.rowVersion,
      payloadDelta: { email: 'c@c.com' }
    });
    console.log('Update 2:', e3.id, 'rowVersion:', e3.rowVersion);
    
  } catch (err: any) {
    console.error('Error:', err.message, err.stack);
  } finally {
    process.exit(0);
  }
}
main();
