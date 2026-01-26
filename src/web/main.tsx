import React from 'react';
import ReactDOM from 'react-dom/client';
import '../renderer/index.css';
import { ReportApp } from './reportApp';

document.documentElement.classList.add('web-report');
document.body.classList.add('web-report');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReportApp />
  </React.StrictMode>
);
