import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { DemoBanner } from './demo/DemoBanner';
import { IS_DEMO } from './demo/kernel';
import { setDemoSocket } from './lib/socket';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } } });

async function boot() {
  if (IS_DEMO) {
    const demo = await import('./demo/server');
    setDemoSocket(demo.socket);
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          {IS_DEMO && (
            <DemoBanner
              repo="taskflow"
              onReset={async () => {
                const { store } = await import('./demo/server');
                store.reset();
                localStorage.removeItem('taskflow.token');
                location.reload();
              }}
            />
          )}
          <AuthProvider>
            <App />
            <Toaster position="bottom-right" closeButton toastOptions={{ style: { borderRadius: 14 } }} />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

boot();
