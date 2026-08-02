import React from 'react';

type Props = {
  role?: string;
  personalCount?: number;
  effectiveCount?: number;
  groupNames?: string[];
  compact?: boolean;
};

/** Makes permission provenance explicit: role/group inheritance is read-only,
 * personal grants are the editable source, and effective permissions are the
 * computed result. */
export const PermissionSourceSummary: React.FC<Props> = ({ role, personalCount = 0, effectiveCount = 0, groupNames = [], compact = false }) => (
  <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1' : 'mt-2'}`} aria-label="权限来源">
    {role && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">角色 · {role}</span>}
    <span className="rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">个人直授 · {personalCount}</span>
    {groupNames.map(name => <span key={name} className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">群组 · {name}</span>)}
    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">最终有效 · {effectiveCount}</span>
  </div>
);

export default PermissionSourceSummary;
