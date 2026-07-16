import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '../../src/ui/App';
import '../../src/ui/main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App surface="options" />
  </StrictMode>,
);
