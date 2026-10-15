import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DispatchModule } from './DispatchModule';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DispatchModule />
  </StrictMode>,
);
