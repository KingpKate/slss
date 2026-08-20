import React from 'react';
import { Layout } from '../Layout';

/**
 * Stable application-shell entry point.
 *
 * Pages should depend on AppShell rather than the legacy Layout filename. The
 * implementation remains compatible with the existing permission-aware
 * navigation while the remaining pages migrate to the new design system.
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Layout>{children}</Layout>
);

export default AppShell;
