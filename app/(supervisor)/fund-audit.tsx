import { useAuth } from '../../src/hooks/useAuth';
import { AuditLogList } from '../../src/components/AuditLogList';

export default function SupervisorAudit() {
  const { supervisedFundIds } = useAuth();
  return <AuditLogList fundIds={supervisedFundIds} />;
}
