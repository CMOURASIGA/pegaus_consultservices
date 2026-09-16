import assert from "node:assert/strict";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.PREFLIGHT_DATABASE_URL;
if (!connectionString?.includes("127.0.0.1:54322")) {
  throw new Error("Preflight refuses non-local database URLs");
}

const ids = {
  ownerA: "10000000-0000-4000-8000-000000000001",
  ownerB: "10000000-0000-4000-8000-000000000002",
  deviceA: "20000000-0000-4000-8000-000000000001",
  deviceB: "20000000-0000-4000-8000-000000000002",
  taskA: "30000000-0000-4000-8000-000000000001",
  taskB: "30000000-0000-4000-8000-000000000002",
  correlation: "40000000-0000-4000-8000-000000000001",
  identity: "50000000-0000-4000-8000-000000000001",
};

let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write("ok " + checks + " - " + message + "\n");
}

async function connect() {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function query(text, values = []) {
  const client = await connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}

async function asRole(role, ownerId, text, values = []) {
  if (!["anon", "authenticated", "service_role"].includes(role)) throw new Error("invalid role");
  const client = await connect();
  try {
    await client.query("begin");
    await client.query("set local role " + role);
    if (ownerId) await client.query("select set_config('request.jwt.claim.sub',$1,true)", [ownerId]);
    const result = await client.query(text, values);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function rejects(operation, pattern, message) {
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  ok(Boolean(caught) && pattern.test(String(caught.message)), message);
  return caught;
}

async function seed() {
  await query(
    "insert into auth.users(id,aud,role,email,created_at,updated_at) values ($1,'authenticated','authenticated','a@example.invalid',now(),now()),($2,'authenticated','authenticated','b@example.invalid',now(),now()) on conflict (id) do nothing",
    [ids.ownerA, ids.ownerB],
  );
  await query(
    "insert into public.devices(id,owner_id,friendly_name,trust_level,execution_level,capabilities,status,paired_at,last_seen_at) values ($1,$2,'A device','trusted','assist','{\"filesystem.list\":true}'::jsonb,'online',now(),now()),($3,$4,'B device','trusted','assist','{\"filesystem.list\":true}'::jsonb,'online',now(),now())",
    [ids.deviceA, ids.ownerA, ids.deviceB, ids.ownerB],
  );
  await query(
    "insert into public.tasks(id,owner_id,title,status,state_version,correlation_id) values ($1,$2,'A task','running',0,$5),($3,$4,'B task','running',0,$5)",
    [ids.taskA, ids.ownerA, ids.taskB, ids.ownerB, ids.correlation],
  );
  await query(
    "insert into public.device_capability_grants(owner_id,device_id,capability,status) values ($1,$2,'filesystem.list','active'),($3,$4,'filesystem.list','active')",
    [ids.ownerA, ids.deviceA, ids.ownerB, ids.deviceB],
  );
  await query(
    "insert into public.device_agent_identities(id,owner_id,device_id,key_id,public_key,status) values ($1,$2,$3,'key-a','test-public-key','active')",
    [ids.identity, ids.ownerA, ids.deviceA],
  );
}

async function requestApproval(suffix = "") {
  const fingerprint = "fp-" + suffix;
  const payload = { path: ".", marker: suffix };
  const result = await query(
    "select to_jsonb(public.request_device_action_approval($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,now()+interval '10 minutes',$11)) as approval",
    [ids.ownerA, ids.taskA, ids.deviceA, "filesystem.list", "authorized-root", "filesystem.list",
      JSON.stringify(payload), fingerprint, "approval", "medium", ids.correlation],
  );
  const approval = result.rows[0].approval;
  await query("select public.decide_device_action_approval($1,$2,'approved')", [approval.id, ids.ownerA]);
  return { approval, fingerprint, payload };
}

async function createCommand(input, overrides = {}) {
  const value = { owner: ids.ownerA, task: ids.taskA, device: ids.deviceA,
    approval: input.approval.id, capability: "filesystem.list", operation: "filesystem.list",
    target: "authorized-root", payload: input.payload, fingerprint: input.fingerprint,
    idempotency: "idem-" + input.fingerprint, nonce: "command-nonce-" + input.fingerprint,
    correlation: ids.correlation, ...overrides };
  return query(
    "select * from public.create_authorized_device_command($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,now()+interval '10 minutes',$12)",
    [value.owner,value.task,value.device,value.approval,value.capability,value.operation,value.target,
      JSON.stringify(value.payload),value.fingerprint,value.idempotency,value.nonce,value.correlation],
  );
}

async function schemaAndPrivileges() {
  const tables = ["device_capability_grants","device_agent_identities","device_request_nonces",
    "device_commands","device_execution_attempts","device_command_results"];
  const tableResult = await query("select table_name from information_schema.tables where table_schema='public' and table_name=any($1)", [tables]);
  ok(tableResult.rowCount === tables.length, "all six operational tables exist");

  const functionSignatures = [
    "public.transition_task(uuid,uuid,text,text,bigint,numeric,text,text)",
    "public.request_device_action_approval(uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamp with time zone,uuid)",
    "public.decide_device_action_approval(uuid,uuid,text)",
    "public.revoke_device_action_approval(uuid,uuid)",
    "public.create_authorized_device_command(uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamp with time zone,uuid)",
    "public.acquire_device_command_lease(uuid,text,text,integer)",
    "public.complete_device_pairing(uuid,text,text,text,text)",
    "public.rotate_device_agent_identity(uuid,uuid,text,text,text)",
    "public.record_device_heartbeat(uuid,uuid,text,text,jsonb)",
    "public.record_device_command_receipt(uuid,uuid,uuid,uuid,text,text,text,text,text)",
    "public.record_device_command_result(uuid,uuid,uuid,uuid,text,text,text,text,jsonb,text,text,text,uuid,boolean)",
    "public.revoke_device_runtime(uuid,uuid,text)",
  ];
  const functionResult = await query(`
    with expected(signature) as (select unnest($1::text[]))
    select expected.signature, p.proname, p.prosecdef, p.proconfig, p.proacl is null as uses_default_acl
    from expected
    left join pg_proc p on p.oid=to_regprocedure(expected.signature)
  `, [functionSignatures]);
  ok(functionResult.rowCount === functionSignatures.length && functionResult.rows.every(row => row.proname),
    "all exact authorization and Gateway function signatures exist");
  ok(functionResult.rows.every(row => row.prosecdef && row.proconfig?.includes("search_path=public")),
    "security definer functions have fixed public search_path");
  ok(functionResult.rows.every(row => !row.uses_default_acl),
    "server-only functions have explicit ACLs rather than PUBLIC defaults");

  const rls = await query("select relname, relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relname=any($1)", [tables]);
  ok(rls.rows.every(row => row.relrowsecurity), "RLS is enabled on every new operational table");

  for (const role of ["anon", "authenticated"]) {
    const execute = await query(`
      select bool_or(has_function_privilege($1,p.oid,'EXECUTE')) as allowed
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.oid=any(array(select to_regprocedure(signature) from unnest($2::text[]) signature))
    `, [role, functionSignatures]);
    ok(execute.rows[0].allowed === false, role + " cannot execute server-only functions");
  }

  const serviceExecute = await query(`
    select bool_and(has_function_privilege('service_role',p.oid,'EXECUTE')) as allowed
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.oid=any(array(select to_regprocedure(signature) from unnest($1::text[]) signature))
  `, [functionSignatures]);
  ok(serviceExecute.rows[0].allowed, "service_role can execute all operational functions");

  const authSelect = await asRole("authenticated", ids.ownerA,
    "select id from public.devices where owner_id=$1 union all select id from public.tasks where owner_id=$1", [ids.ownerA]);
  ok(authSelect.rowCount === 2, "authenticated owner retains intended read access");

  const denied = [
    ["create Task", "insert into public.tasks(owner_id,title) values($1,'forbidden')", [ids.ownerA]],
    ["alter Task", "update public.tasks set status='completed' where id=$1", [ids.taskA]],
    ["alter task step", "insert into public.task_steps(owner_id,task_id,step_no,title) values($1,$2,1,'forbidden')", [ids.ownerA,ids.taskA]],
    ["alter device trust", "update public.devices set trust_level='trusted' where id=$1", [ids.deviceA]],
    ["grant capability", "insert into public.device_capability_grants(owner_id,device_id,capability) values($1,$2,'filesystem.read')", [ids.ownerA,ids.deviceA]],
    ["create command", "insert into public.device_commands(owner_id,task_id,device_id,idempotency_key,capability,operation,target,action_fingerprint,command_nonce_hash,expires_at,correlation_id) values($1,$2,$3,'x','filesystem.list','filesystem.list','x','x','x',now()+interval '1 minute',$4)", [ids.ownerA,ids.taskA,ids.deviceA,ids.correlation]],
    ["create execution attempt", "insert into public.device_execution_attempts(owner_id,command_id,device_id,attempt_no,lease_token_hash) values($1,gen_random_uuid(),$2,1,'x')", [ids.ownerA,ids.deviceA]],
  ];
  for (const [name, sql, values] of denied) {
    await rejects(() => asRole("authenticated", ids.ownerA, sql, values), /permission denied/,
      "authenticated cannot " + name);
  }
  await rejects(() => asRole("authenticated", ids.ownerA,
    "select public.acquire_device_command_lease($1,repeat('x',32),repeat('n',32),30)", [ids.deviceA]), /permission denied/,
    "authenticated cannot acquire a lease");
}

async function taskConcurrency() {
  const concurrentTask = "30000000-0000-4000-8000-000000000003";
  await query(
    "insert into public.tasks(id,owner_id,title,status,state_version,correlation_id) values($1,$2,'Concurrency task','running',0,$3)",
    [concurrentTask, ids.ownerA, ids.correlation],
  );
  const before = await query("select status,state_version from public.tasks where id=$1", [concurrentTask]);
  ok(before.rows[0].status === "running" && before.rows[0].state_version === "0",
    "concurrency fixture starts at expected Task version");
  const call = () => query("select public.transition_task($1,$2,'running','waiting_device',0,null,null,null)", [concurrentTask,ids.ownerA]);
  const results = await Promise.allSettled([call(), call()]);
  process.stdout.write("Task concurrency outcomes: " + JSON.stringify(results.map(result =>
    result.status === "fulfilled" ? { status: result.status } : { status: result.status, code: result.reason.code, message: result.reason.message }
  )) + "\n");
  ok(results.filter(r => r.status === "fulfilled").length === 1, "only one concurrent Task transition wins");
  ok(results.filter(r => r.status === "rejected" && /task_transition_conflict/.test(r.reason.message)).length === 1,
    "losing Task transition reports optimistic concurrency conflict");
}

async function approvalAtomicityAndFingerprint() {
  const atomic = await requestApproval("atomic");
  await rejects(() => createCommand(atomic, { payload: { path: "changed" } }), /approval_not_consumable/,
    "modified payload fails closed");
  const state = await query("select status from public.approvals where id=$1", [atomic.approval.id]);
  const count = await query("select count(*)::int as count from public.device_commands where approval_id=$1", [atomic.approval.id]);
  ok(state.rows[0].status === "approved" && count.rows[0].count === 0,
    "failed validation neither consumes Approval nor creates command");

  const mutations = [
    ["device", { device: ids.deviceB }],
    ["capability", { capability: "filesystem.read" }],
    ["operation", { operation: "filesystem.read" }],
    ["owner", { owner: ids.ownerB }],
    ["Task", { task: ids.taskB }],
  ];
  for (const [label, override] of mutations) {
    const candidate = await requestApproval("mutation-" + label);
    await rejects(() => createCommand(candidate, override), /(approval_not_consumable|operation_not_registered|device_not_capable|capability_not_granted|task_not_dispatchable)/,
      "changed " + label + " fails closed");
    const preserved = await query("select status from public.approvals where id=$1", [candidate.approval.id]);
    ok(preserved.rows[0].status === "approved", "changed " + label + " does not consume Approval");
  }

  const approved = await requestApproval("concurrent");
  const concurrent = await Promise.allSettled([createCommand(approved), createCommand(approved)]);
  ok(concurrent.filter(r => r.status === "fulfilled").length === 1, "only one concurrent Approval consumption creates a command");
  ok(concurrent.filter(r => r.status === "rejected").length === 1, "second concurrent Approval consumption is rejected");
  const approvalState = await query("select status,consumed_at is not null as consumed from public.approvals where id=$1", [approved.approval.id]);
  ok(approvalState.rows[0].status === "consumed" && approvalState.rows[0].consumed, "Approval is atomically consumed once");

  const duplicate = await createCommand(approved);
  ok(duplicate.rows[0].created === false, "identical idempotency replay returns existing command without re-execution");
  await rejects(() => createCommand(approved, { fingerprint: "different-fingerprint" }), /idempotency_fingerprint_conflict/,
    "same idempotency key with a different fingerprint is rejected");
  return concurrent.find(r => r.status === "fulfilled").value.rows[0].command;
}

async function leaseConcurrency(command) {
  const callA = () => query("select to_jsonb(public.acquire_device_command_lease($1,repeat('a',32),repeat('n',32),30)) as command", [ids.deviceA]);
  const callB = () => query("select to_jsonb(public.acquire_device_command_lease($1,repeat('b',32),repeat('m',32),30)) as command", [ids.deviceA]);
  const results = await Promise.all([callA(), callB()]);
  ok(results.filter(result => result.rows[0].command?.id === command.id).length === 1,
    "only one of two Agent callers acquires the command lease");
  const attempts = await query("select count(*)::int as count from public.device_execution_attempts where command_id=$1", [command.id]);
  ok(attempts.rows[0].count === 1, "exclusive lease creates exactly one execution attempt");
}

async function gatewayProtocol() {
  const heartbeat = await query(
    "select public.record_device_heartbeat($1,$2,'0.1.0-test','Windows test',to_jsonb(array['filesystem.list'])) as value",
    [ids.identity,ids.deviceA],
  );
  ok(heartbeat.rows[0].value.online === true, "authenticated heartbeat derives online state in the backend");

  const approved = await requestApproval("gateway-flow");
  const created = await createCommand(approved);
  const command = created.rows[0].command;
  const leaseHash = "gateway-lease-hash-value-00000001";
  const commandNonceHash = "gateway-command-nonce-hash-00001";
  const leased = await query(
    "select to_jsonb(public.acquire_device_command_lease($1,$2,$3,30)) as command",
    [ids.deviceA,leaseHash,commandNonceHash],
  );
  ok(leased.rows[0].command?.id === command.id, "Gateway acquires an authorized command with an exclusive lease");
  const attempt = await query(
    "select id from public.device_execution_attempts where command_id=$1 and attempt_no=1",
    [command.id],
  );

  await rejects(() => query(
    "select public.record_device_command_receipt($1,$2,$3,$4,$5,$6,$7,'accepted',null)",
    [ids.identity,ids.deviceA,command.id,attempt.rows[0].id,leaseHash,"wrong-command-nonce-hash-000000","receipt-request-nonce-hash-00001"],
  ), /lease_not_valid/, "receipt with a different command nonce fails closed");

  const receipt = await query(
    "select public.record_device_command_receipt($1,$2,$3,$4,$5,$6,$7,'accepted',null) as value",
    [ids.identity,ids.deviceA,command.id,attempt.rows[0].id,leaseHash,commandNonceHash,"receipt-request-nonce-hash-00001"],
  );
  ok(receipt.rows[0].value.correlationId === ids.correlation, "authenticated receipt preserves correlation ID");
  await rejects(() => query(
    "select public.record_device_command_receipt($1,$2,$3,$4,$5,$6,$7,'accepted',null)",
    [ids.identity,ids.deviceA,command.id,attempt.rows[0].id,leaseHash,commandNonceHash,"receipt-request-nonce-hash-00001"],
  ), /lease_not_valid|receipt_not_valid/, "receipt replay is rejected");

  const result = await query(
    "select public.record_device_command_result($1,$2,$3,$4,$5,$6,$7,'completed',$8::jsonb,null,'0.1.0-test',null,$9,false) as value",
    [ids.identity,ids.deviceA,command.id,attempt.rows[0].id,leaseHash,commandNonceHash,
      "result-request-nonce-hash-0000001",JSON.stringify({ entries: ["example.txt"] }),ids.correlation],
  );
  ok(result.rows[0].value.terminal && result.rows[0].value.successful,
    "structured result terminates the command successfully");
  await rejects(() => query(
    "select public.record_device_command_result($1,$2,$3,$4,$5,$6,$7,'completed',$8::jsonb,null,'0.1.0-test',null,$9,false)",
    [ids.identity,ids.deviceA,command.id,attempt.rows[0].id,leaseHash,commandNonceHash,
      "result-request-nonce-hash-0000001",JSON.stringify({ entries: [] }),ids.correlation],
  ), /lease_not_valid|result_not_valid/, "result replay is rejected");

  const audit = await query(
    "select count(*)::int as count from public.audit_events where correlation_id=$1 and action in ('device.command.leased','device.command.receipt','device.command.result')",
    [ids.correlation],
  );
  ok(audit.rows[0].count >= 3, "lease, receipt and result produce a correlated audit trail");

  const noGrantApproval = await requestApproval("missing-grant");
  const noGrantCommand = (await createCommand(noGrantApproval)).rows[0].command;
  await query("update public.device_capability_grants set status='revoked',revoked_at=now() where device_id=$1 and capability='filesystem.list'", [ids.deviceA]);
  const noGrantLease = await query(
    "select to_jsonb(public.acquire_device_command_lease($1,repeat('g',32),repeat('n',32),30)) as command",
    [ids.deviceA],
  );
  ok(noGrantLease.rows[0].command === null, "revoked capability cannot acquire a queued command");
  await query("update public.device_capability_grants set status='active',revoked_at=null where device_id=$1 and capability='filesystem.list'", [ids.deviceA]);
  await query("update public.device_commands set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 second' where id=$1", [noGrantCommand.id]);
  const expired = await query(
    "select to_jsonb(public.acquire_device_command_lease($1,repeat('e',32),repeat('x',32),30)) as command",
    [ids.deviceA],
  );
  ok(expired.rows[0].command === null, "expired command is never leased");

  const offlineApproval = await requestApproval("offline-device");
  const offlineCommand = (await createCommand(offlineApproval)).rows[0].command;
  await query("update public.devices set status='online',last_seen_at=now()-interval '5 minutes' where id=$1", [ids.deviceA]);
  const offline = await query(
    "select to_jsonb(public.acquire_device_command_lease($1,repeat('o',32),repeat('f',32),30)) as command",
    [ids.deviceA],
  );
  ok(offline.rows[0].command === null, "stale heartbeat derives an offline device and blocks leasing");
  await query("update public.device_commands set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 second' where id=$1", [offlineCommand.id]);
  await query("select public.record_device_heartbeat($1,$2,'0.1.0-test','Windows test',to_jsonb(array['filesystem.list']))", [ids.identity,ids.deviceA]);

  const retryApproval = await requestApproval("lease-expiry");
  const retryCommand = (await createCommand(retryApproval)).rows[0].command;
  const firstLease = await query(
    "select to_jsonb(public.acquire_device_command_lease($1,repeat('1',32),repeat('2',32),30)) as command",
    [ids.deviceA],
  );
  ok(firstLease.rows[0].command?.id === retryCommand.id, "first command lease succeeds");
  await query("update public.device_commands set lease_expires_at=now()-interval '1 second' where id=$1", [retryCommand.id]);
  const secondLease = await query(
    "select to_jsonb(public.acquire_device_command_lease($1,repeat('3',32),repeat('4',32),30)) as command",
    [ids.deviceA],
  );
  ok(secondLease.rows[0].command?.id === retryCommand.id && secondLease.rows[0].command.attempt_count === 2,
    "expired lease is safely reacquired as a new execution attempt");

  await query("select public.revoke_device_runtime($1,$2,'preflight')", [ids.ownerA,ids.deviceA]);
  const revoked = await query("select status,revoked_at is not null as revoked from public.devices where id=$1", [ids.deviceA]);
  ok(revoked.rows[0].status === 'revoked' && revoked.rows[0].revoked, "revocation immediately disables the device");
  await rejects(() => query(
    "select public.record_device_heartbeat($1,$2,'0.1.0-test','Windows test',to_jsonb(array['filesystem.list']))",
    [ids.identity,ids.deviceA],
  ), /identity_not_active/, "revoked Agent identity cannot send heartbeat");
}

async function nonceReplay() {
  const insert = nonce => query(
    "insert into public.device_request_nonces(device_id,identity_id,nonce_hash,request_kind,expires_at) values($1,$2,$3,'poll',now()+interval '2 minutes')",
    [ids.deviceA,ids.identity,nonce],
  );
  const results = await Promise.allSettled([insert("same-nonce"), insert("same-nonce")]);
  ok(results.filter(r => r.status === "fulfilled").length === 1, "only one concurrent nonce registration wins");
  ok(results.filter(r => r.status === "rejected" && r.reason.code === "23505").length === 1,
    "reused nonce is rejected by a unique constraint");
}

async function constraintsAndIndexes() {
  const constraints = await query(`
    select conname from pg_constraint
    where connamespace='public'::regnamespace
      and conname in ('device_capability_grants_expiry_check','device_commands_expiry_check',
        'device_capability_grants_device_id_capability_key','device_commands_owner_id_idempotency_key_key',
        'device_request_nonces_identity_id_nonce_hash_key')
  `);
  ok(constraints.rowCount === 5, "required expiry, idempotency and replay constraints exist");
  const indexes = await query(`
    select count(*)::int as count from pg_indexes
    where schemaname='public' and indexname in
      ('device_capability_grants_lookup_idx','device_agent_identities_lookup_idx',
       'device_request_nonces_expiry_idx','device_commands_poll_idx',
       'device_commands_task_idx','device_execution_attempts_command_idx',
       'tasks_owner_idempotency_uidx','approvals_fingerprint_idx')
  `);
  ok(indexes.rows[0].count === 8, "required lookup and uniqueness indexes exist");
}

try {
  await seed();
  await constraintsAndIndexes();
  await schemaAndPrivileges();
  await taskConcurrency();
  const command = await approvalAtomicityAndFingerprint();
  await leaseConcurrency(command);
  await nonceReplay();
  await gatewayProtocol();
  process.stdout.write("\nMigration preflight passed: " + checks + " assertions.\n");
} catch (error) {
  console.error("Migration preflight failed:", {
    message: error.message,
    code: error.code,
    detail: error.detail,
    constraint: error.constraint,
  });
  process.exitCode = 1;
}
