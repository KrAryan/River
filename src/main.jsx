import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import KoiRiver from './KoiRiver';
import './demo.css';

/* Demo page: the component centered on a white background. The scene
   sizes itself to the viewport while keeping a 16:9 ratio. */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KoiRiver style={{ width: 'min(94vw, 165vh)' }} />
  </StrictMode>
);
