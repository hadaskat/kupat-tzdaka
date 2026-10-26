import { AuditLogList } from '../../src/components/AuditLogList';

export default function AdminAudit() {
  // null = unrestricted: the super admin sees the entire log.
  return <AuditLogList back fundIds={null} />;
}
