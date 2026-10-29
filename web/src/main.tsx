import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/500.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/500.css';
import '@fontsource/noto-sans-devanagari/600.css';
import './design/index.css';
import './i18n';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Toaster, TooltipProvider } from '@/components/ui';
import { AppShell } from '@/app/AppShell';
import { FlowLayout, NewAssessment } from '@/features/assess/flow';
import { IdentifyStep } from '@/features/assess/IdentifyStep';
import { InspectStep } from '@/features/assess/InspectStep';
import { QuestionsStep } from '@/features/assess/QuestionsStep';
import { DiagnosisStep } from '@/features/assess/DiagnosisStep';
import { DecisionStep } from '@/features/assess/DecisionStep';
import { PassportStep } from '@/features/passport/PassportStep';
import { ComposerPage } from '@/pages/ComposerPage';
import { DesignPage } from '@/pages/DesignPage';
import { ImpactPage } from '@/pages/ImpactPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { PanelPassportPage, PanelsPage } from '@/pages/PanelsPage';
import { PublicPassportPage } from '@/pages/PublicPassportPage';
import { SettingsPage } from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: 1, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/panels', element: <PanelsPage /> },
      { path: '/panels/:id', element: <PanelPassportPage /> },
      { path: '/composer', element: <ComposerPage /> },
      { path: '/impact', element: <ImpactPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '/assess/new', element: <NewAssessment /> },
  {
    path: '/assess/:id',
    element: <FlowLayout />,
    children: [
      { index: true, element: <Navigate to="identify" replace /> },
      { path: '*', element: <Navigate to="identify" replace /> },
      { path: 'identify', element: <IdentifyStep /> },
      { path: 'inspect', element: <InspectStep /> },
      { path: 'questions', element: <QuestionsStep /> },
      { path: 'diagnosis', element: <DiagnosisStep /> },
      { path: 'decision', element: <DecisionStep /> },
      { path: 'passport', element: <PassportStep /> },
    ],
  },
  { path: '/p/:id', element: <PublicPassportPage /> },
  { path: '/design', element: <DesignPage /> },
]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
