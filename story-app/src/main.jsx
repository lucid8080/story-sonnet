import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const appTree = clerkKey ? (
  <ClerkProvider publishableKey={clerkKey}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ClerkProvider>
) : (
  <AuthProvider>
    <App />
  </AuthProvider>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>{appTree}</StrictMode>
);
