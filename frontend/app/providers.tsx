'use client';

import React from 'react';
import { AuthProvider, RidesProvider, WalletProvider, SocketProvider, MapProvider } from '@/src/contexts';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary level="page">
      <AuthProvider>
        <RidesProvider>
          <WalletProvider>
            <SocketProvider>
              <MapProvider>
                {children}
              </MapProvider>
            </SocketProvider>
          </WalletProvider>
        </RidesProvider>
      </AuthProvider>
      <ToastProvider />
    </ErrorBoundary>
  );
}
