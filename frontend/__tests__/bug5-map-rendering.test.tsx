/**
 * Bug 5 — Map Not Rendering Exploration Test
 *
 * This test MUST FAIL on unfixed code.
 * Failure confirms the bug: TrackRide renders a static placeholder div with
 * "Map View" text instead of an interactive Leaflet map.
 *
 * Counterexample: "TrackRide renders placeholder text 'Map View' instead of
 * a Leaflet map"
 *
 * Validates: Requirements 1.13, 1.15
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import React from 'react';

// ---------------------------------------------------------------------------
// The bug in TrackRide.tsx (unfixed):
//
//   <div className="absolute inset-0 bg-gray-100">
//     <div className="w-full h-full flex items-center justify-center">
//       ...
//       {driverLocation ? (
//         <p>Driver Location</p>  // raw text, no map
//       ) : (
//         <p>Map View</p>         // placeholder text
//       )}
//     </div>
//   </div>
//
// No Leaflet MapContainer is rendered — only a static placeholder div.
// The fix should render a <MapContainer> from react-leaflet which produces
// a DOM element with class "leaflet-container".
// ---------------------------------------------------------------------------

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement('div', props, children),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) =>
      React.createElement('button', props, children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Socket event handlers registry — populated when TrackRide calls socket.on()
const socketHandlers: Record<string, Function> = {};

// Mock socket context with a socket that captures event handlers
vi.mock('@/src/contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: {
      on: (event: string, handler: Function) => { socketHandlers[event] = handler; },
      off: (event: string) => { delete socketHandlers[event]; },
      emit: vi.fn(),
    },
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Navigation: () => React.createElement('span', { 'data-testid': 'navigation-icon' }),
  Phone: () => React.createElement('span', { 'data-testid': 'phone-icon' }),
  MessageSquare: () => React.createElement('span', { 'data-testid': 'message-icon' }),
  Clock: () => React.createElement('span', { 'data-testid': 'clock-icon' }),
  Car: () => React.createElement('span', { 'data-testid': 'car-icon' }),
  AlertTriangle: () => React.createElement('span', { 'data-testid': 'alert-icon' }),
  ChevronLeft: () => React.createElement('span', { 'data-testid': 'chevron-icon' }),
  Share2: () => React.createElement('span', { 'data-testid': 'share-icon' }),
  MoreVertical: () => React.createElement('span', { 'data-testid': 'more-icon' }),
  WifiOff: () => React.createElement('span', { 'data-testid': 'wifi-off-icon' }),
}));

// Mock react-leaflet to avoid browser API issues in jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
    React.createElement('div', { className: 'leaflet-container', style }, children),
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-marker' }, children),
  Popup: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-popup' }, children),
  useMap: () => ({ setView: vi.fn(), getZoom: vi.fn(() => 15) }),
}));

// Mock leaflet to avoid browser API issues in jsdom
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
}));

// Mock LeafletMap (the dynamically-loaded component) so next/dynamic resolves in tests
vi.mock('@/components/bookings/LeafletMap', () => ({
  default: ({ lat, lng, driverName }: { lat: number; lng: number; driverName: string }) =>
    React.createElement('div', { className: 'leaflet-container', 'data-testid': 'leaflet-map' },
      React.createElement('div', { 'data-testid': 'map-marker' }, driverName)
    ),
}));

// Mock next/dynamic so the dynamic import resolves synchronously in tests
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<any>) => {
    // Return a component that renders the mock synchronously
    const DynamicComponent = (props: any) => {
      const [Component, setComponent] = React.useState<any>(null);
      React.useEffect(() => {
        loader().then((mod) => setComponent(() => mod.default || mod));
      }, []);
      return Component ? React.createElement(Component, props) : null;
    };
    return DynamicComponent;
  },
}));

const mockRide = {
  id: 'ride-001',
  driver: {
    name: 'Test Driver',
    avatar: 'https://example.com/avatar.jpg',
    phone: '+91-9999999999',
    rating: 4.8,
    vehicle: {
      model: 'Honda City',
      number: 'KA-01-AB-1234',
      color: 'White',
    },
  },
  pickup: 'Koramangala, Bangalore',
  drop: 'Indiranagar, Bangalore',
  time: '10:30 AM',
  date: '2024-01-15',
  price: 250,
};

describe('Bug 5 — Map Not Rendering (MUST FAIL on unfixed code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear socket handlers between tests
    Object.keys(socketHandlers).forEach(k => delete socketHandlers[k]);
  });

  it('should render a .leaflet-container element when isVisible=true and driverLocation is set', async () => {
    const { default: TrackRide } = await import('@/components/bookings/TrackRide');

    // Render the component — socket handlers get registered during mount
    await act(async () => {
      render(
        React.createElement(TrackRide, {
          ride: mockRide,
          status: 'on_the_way',
          isVisible: true,
          onClose: vi.fn(),
          showSOS: false,
        })
      );
    });

    // Simulate a LOCATION_UPDATE event to set driverLocation state
    await act(async () => {
      if (socketHandlers['LOCATION_UPDATE']) {
        socketHandlers['LOCATION_UPDATE']({
          rideId: 'ride-001',
          lat: 12.9716,
          lng: 77.5946,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Assert: a Leaflet map container should exist in the DOM
    // This FAILS on unfixed code: only a static placeholder div is rendered,
    // no .leaflet-container element exists
    const leafletContainer = document.querySelector('.leaflet-container');
    expect(leafletContainer).not.toBeNull();
  });

  it('should NOT render "Map View" placeholder text after fix', async () => {
    const { default: TrackRide } = await import('@/components/bookings/TrackRide');

    await act(async () => {
      render(
        React.createElement(TrackRide, {
          ride: mockRide,
          status: 'on_the_way',
          isVisible: true,
          onClose: vi.fn(),
          showSOS: false,
        })
      );
    });

    // On fixed code, "Map View" should NOT be present (placeholder removed)
    // FAILS on unfixed code because "Map View" IS present
    const mapViewText = screen.queryByText('Map View');
    expect(mapViewText).toBeNull();
  });

  it('scoped PBT: for any { isVisible: true, status: on_the_way }, leaflet-container must exist in DOM after location update', async () => {
    const { default: TrackRide } = await import('@/components/bookings/TrackRide');

    const statuses = ['on_the_way', 'arrived', 'in_progress'] as const;

    for (const status of statuses) {
      // Clear handlers before each iteration
      Object.keys(socketHandlers).forEach(k => delete socketHandlers[k]);

      let unmount: () => void;
      await act(async () => {
        const result = render(
          React.createElement(TrackRide, {
            ride: { ...mockRide, id: `ride-${status}` },
            status,
            isVisible: true,
            onClose: vi.fn(),
            showSOS: false,
          })
        );
        unmount = result.unmount;
      });

      // Simulate location update
      await act(async () => {
        if (socketHandlers['LOCATION_UPDATE']) {
          socketHandlers['LOCATION_UPDATE']({
            rideId: `ride-${status}`,
            lat: 12.9716,
            lng: 77.5946,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // FAILS on unfixed code: no Leaflet map is rendered for any status
      const leafletContainer = document.querySelector('.leaflet-container');
      expect(leafletContainer).not.toBeNull();

      unmount!();
    }
  });
});
