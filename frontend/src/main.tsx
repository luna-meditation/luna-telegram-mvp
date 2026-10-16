import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './mobile-refinement.css';
import './premium-experience.css';
import './luna25-home.css';
import './luna251-conversation.css';
import './luna30-experience.css';
import './luna31-experience.css';
import {AmbientSky} from './design-system/components/AmbientSky';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AmbientSky />
    <App />
  </React.StrictMode>
);
