import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import './i18n';
import i18n from './i18n'; // Direct access to language

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
    init = init || {};
    init.headers = {
        ...init.headers,
        'Accept-Language': i18n.language
    };
    return originalFetch(input, init);
};

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>,
)
