import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './mobile-refinement.css';
import './premium-experience.css';
import './luna25-home.css';
import {AmbientSky} from './design-system/components/AmbientSky';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AmbientSky />
    <App />
  </React.StrictMode>
);
