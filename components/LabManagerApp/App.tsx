'use client';

import React, { useState, useEffect, JSX } from 'react';
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import EC2Table from './components/EC2Table';
import { SoftmaniaLogo } from "@/components/softmania-logo";
import Link from 'next/link';
import * as CryptoJS from 'crypto-js';

const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID as string;
const API_URL = process.env.NEXT_PUBLIC_API_URL as string;
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

function App(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'softmania_secret';

  const [usage, setUsage] = useState<{
    quota_hours: number;
    used_hours: number;
    balance_hours: number;
    quota_days: number;
    used_days: number;
    balance_days: number;
  } | null>(null);

  const encrypt = (data: string): string => {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  };

  const decrypt = (cipher: string): string => {
    try {
      const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      console.error('Decryption failed:', err);
      return '';
    }
  };

  const getUsernameFromEmail = (email: string): string => {
    if (!email) return '';
    const namePart = email.split('@')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const fetchInstances = async (userEmail: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/instances`, {
        headers: { Authorization: `Bearer ${userEmail}` },
      });
      const data = await res.json();
      setInstances(data);
    } catch (error) {
      console.error("Error fetching instances:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageSummary = async (userEmail: string) => {
    try {
      const res = await fetch(`${API_URL}/usage-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      if (!res.ok) throw new Error("Usage fetch failed");

      const data = await res.json();

      // Map API keys to expected UI keys
      setUsage({
        quota_hours: data.QuotaHours,
        used_hours: data.ConsumedHours,
        balance_hours: data.BalanceHours,
        quota_days: data.QuotaExpiryDays,
        used_days: data.ConsumedDays,
        balance_days: data.BalanceDays
      });
    } catch (err) {
      console.error("Error fetching usage summary:", err);
    }
  };


  const handleLogin = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const userEmail = decoded.email;
      const loginTime = new Date().getTime();

      localStorage.setItem('userEmail', encrypt(userEmail));
      localStorage.setItem('loginTime', encrypt(loginTime.toString()));

      setEmail(userEmail);
      fetchInstances(userEmail);
      fetchUsageSummary(userEmail);
    }
  };

  useEffect(() => {
    const encryptedEmail = localStorage.getItem('userEmail');
    const encryptedLoginTime = localStorage.getItem('loginTime');

    if (encryptedEmail && encryptedLoginTime) {
      const storedEmail = decrypt(encryptedEmail);
      const loginTime = parseInt(decrypt(encryptedLoginTime), 10);

      const now = new Date().getTime();
      const timeElapsed = now - loginTime;

      if (timeElapsed < SESSION_DURATION_MS) {
        setEmail(storedEmail);
        fetchInstances(storedEmail);
        fetchUsageSummary(storedEmail);
      } else {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('loginTime');
      }
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (email) {
      interval = setInterval(() => {
        fetchInstances(email);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [email]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('loginTime');
    setEmail('');
    setInstances([]);
    setUsage(null);
    setShowLogoutModal(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  useEffect(() => {
    const attrsToRemove = ['bis_skin_checked', 'bis_register'];
    attrsToRemove.forEach(attr => {
      const elements = document.querySelectorAll(`[${attr}]`);
      elements.forEach(el => el.removeAttribute(attr));
    });
  }, []);

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      {/* Header */}
      <header className="border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" passHref>
              <SoftmaniaLogo size="md" />
            </Link>
            <h2 className="lg:text-2xl sm:text-xl font-extrabold text-gray-800">Lab Manager Portal</h2>
          </div>
        </div>
      </header>

      <div style={{ padding: 20 }}>
        {email && (
          <div style={{
            marginBottom: 30,
            padding: 15,
            borderRadius: 10,
            backgroundColor: '#f4f6fa',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>
                Welcome back, <span style={{ color: '#007acc' }}>{getUsernameFromEmail(email)}</span>
              </h2>
              <p style={{ marginTop: 5, fontSize: '1.1rem', color: '#34495e' }}>
                This is your personal <strong>Lab server Manager Dashboard</strong> 🚀
              </p>

              {usage && (
                <div className="w-full text-sm mt-4">
                  {/* Desktop View */}
                  <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-2 bg-green-50 border border-green-200 text-gray-800 rounded-lg px-4 py-3">
                    <span><strong>Quota Hours:</strong> {usage.quota_hours} hrs</span>
                    <span><strong>Used Hours:</strong> {usage.used_hours.toFixed(1)} hrs</span>
                    <span><strong>Balance Hours:</strong> {usage.balance_hours.toFixed(1)} hrs</span>
                    <span className="mx-2 text-gray-400">|</span>
                    <span><strong>Quota Days:</strong> {usage.quota_days} days</span>
                    <span><strong>Used Days:</strong> {usage.used_days.toFixed(1)} days</span>
                    <span><strong>Balance Days:</strong> {usage.balance_days.toFixed(1)} days</span>
                  </div>

                  {/* Mobile View */}
                  <div className="sm:hidden flex flex-col gap-3 bg-green-50 border border-green-200 text-gray-800 rounded-lg px-4 py-3">
                    {/* Days block first */}
                    <div className="flex flex-col gap-1">
                      <p><strong>Quota Days:</strong> {usage.quota_days} days</p>
                      <p><strong>Used Days:</strong> {usage.used_days.toFixed(1)} days</p>
                      <p><strong>Balance Days:</strong> {usage.balance_days.toFixed(1)} days</p>
                    </div>
                    {/* Then Hours block */}
                    <div className="flex flex-col gap-1 pt-2 border-t border-green-200">
                      <p><strong>Quota Hours:</strong> {usage.quota_hours} hrs</p>
                      <p><strong>Used Hours:</strong> {usage.used_hours.toFixed(1)} hrs</p>
                      <p><strong>Balance Hours:</strong> {usage.balance_hours.toFixed(1)} hrs</p>
                    </div>
                  </div>
                </div>
              )}


            </div>

            <button onClick={handleLogout} style={{
              marginLeft: 20,
              marginTop: 10,
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: '#e74c3c',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              height: 'fit-content'
            }}>Logout</button>
          </div>
        )}

        {!email ? (
          <div className="flex flex-col items-center justify-center mt-16">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Login using Google</h2>
            <GoogleLogin
              onSuccess={handleLogin}
              onError={() => console.log("Login Failed")}
            />
          </div>
        ) : (
          <EC2Table
            email={email}
            instances={instances}
            setInstances={setInstances}
            loading={loading}
          />
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[90%] max-w-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to logout from your Lab Manager Dashboard?
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
