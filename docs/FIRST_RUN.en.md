# First login and initial setup

[English](FIRST_RUN.en.md) | [Italiano](FIRST_RUN.md)

This guide follows [INSTALLATION.en.md](INSTALLATION.en.md). It applies to
PostgreSQL and SQLite; it requires neither the demo domain nor optional services.
Labels may vary by language: the canonical areas are described in
[ADMIN_INFORMATION_ARCHITECTURE.md](ADMIN_INFORMATION_ARCHITECTURE.md).

## 1. Verify the empty environment

Sign in at `/login` with the identity configured in `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`. A new installation contains no nodes, entities,
attachments or application types: an empty list is expected, not an error.
The administrator and technical system catalogues are present instead.

If an account with that email already existed, the seed does not change its
password: use the current credential or the configured recovery flow. Do not
reset the database to resolve a login problem.

Change the initial password in the account area and configure MFA according to
deployment policy. Keep recovery codes outside the application. Changing
`SEED_ADMIN_PASSWORD` later does not change the stored password.

## 2. Create the minimum model

Under **Administration → Model → Types**:

1. Create a node type, for example “Work area”. Its name is descriptive; its
   technical key, for example `work_area`, must be stable and valid.
2. If you need child levels, configure placement rules consistent with the
   parent/child types; ensure the chosen type allows root placement.
3. Create an entity type, for example “Task”, with key `work_item`. If the form
   requests it, provide a valid storage table, for example `entity_work_item`;
   do not create tables manually with SQL. This is a model identifier:
   PostgreSQL and SQLite implement it differently internally.
4. Add a simple field, such as a text description. Test saving and reopening
   before adding enums, relationships or attachments.
5. For an enum, configure its options; for a relationship, create the target
   type first. For attachments, add a file/image field.

References: [metadata forms](RESOURCE_METADATA_FORMS.md),
[enums](MANAGED_ENUMS.md), [relationships](RESOURCE_RELATIONSHIP_ARCHITECTURE.md),
[type lifecycle](TYPE_LIFECYCLE.md). These examples are optional and do not tie
Nodriva to a specific application domain.

## 3. Create the first content

In the workspace, create a root node using the new type, give it a name and
open it. Create an entity of type “Task”, fill in its fields and save. Reopen
it and check the values. Change the schema through administration, not by
editing the database directly.

If a type cannot be selected, check that it is active and compatible with
placement rules. Do not bypass backend validation.

## 4. Create an operator and restrict their scope

Under **Administration → Access**:

1. Prepare an operational role with only the required permissions: reading,
   creating and editing nodes/entities; add deletion and restoration only if
   needed. Use the permission selectors, not SQL.
2. Create the user through the available flow. Invitations and password
   recovery require a configured delivery channel: without that integration,
   do not expect automatic emails. Send any initial credentials through a
   secure channel.
3. Assign the role and scope on the relevant node: `self` for that node only,
   `subtree` for its subtree, according to the authorization contract.
4. Sign in as the operator in a different browser profile and check their
   scope. The role alone does not replace scope; a superadmin is unsuitable
   for this check because they have broader privileges.

In a validation environment, also create an out-of-scope node and verify that
it cannot be accessed, even through a direct URL. Do not use real users in
automated tests or distribute operational credentials in scripts.

## 5. Functional checklist

- [ ] Administrator and operator login succeeds.
- [ ] Model and content reopen with consistent values.
- [ ] Scope is checked with a non-superadmin identity.
- [ ] Two sessions on the same record respect locks and version conflicts;
      no unsaved form is abandoned without a warning.
- [ ] If configured: upload, download and delete a test attachment; verify
      scanning when it is mandatory.
- [ ] On test content: deletion, trash and restoration are consistent; audit
      is available under **Administration → Governance**.
- [ ] If realtime is enabled: the second session updates without a reload.
      This check is explicitly excluded for SQLite without realtime.
- [ ] Data and attachments remain available after a controlled restart.
- [ ] Database, payload and key backups are prepared and restoration is verified
      separately: [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

Checks that create or delete content must use authorized test data. Automated
gates use the isolated fixtures in the [release checklist](RELEASE_CHECKLIST.md),
never the operational database.
