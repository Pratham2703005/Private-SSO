'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

interface AccountSwitcherProps {
  currentUser: any;
  onAccountSwitch: () => void;
}

export default function AccountSwitcher({ currentUser, onAccountSwitch }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && accounts.length === 0) {
      fetchAccounts();
    }
  }, [open]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/accounts');
      const data = await res.json();
      if (data.success && data.data) {
        setAccounts(data.data.accounts || []);
      } else {
        setError('Failed to fetch accounts');
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Error loading accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (accountId: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (res.ok) {
        console.log('Account switched successfully');
        setOpen(false);
        onAccountSwitch();
      } else {
        setError('Failed to switch account');
      }
    } catch (err) {
      console.error('Error switching account:', err);
      setError('Error switching account');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = () => {
    // Redirect to add account flow
    window.location.href = '/api/accounts/add';
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '8px 12px',
          backgroundColor: '#f0f0f0',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        👤 {currentUser?.email || 'Account'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minWidth: '250px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>
              Connected Accounts
            </div>

            {loading && <div style={{ padding: '8px', fontSize: '14px' }}>Loading...</div>}

            {error && (
              <div style={{ padding: '8px', fontSize: '12px', color: 'red' }}>
                {error}
              </div>
            )}

            {!loading && accounts.length > 0 && (
              <div>
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleSwitch(account.id)}
                    disabled={account.isActive || loading}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '4px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: account.isActive ? '#e3f2fd' : '#f9f9f9',
                      cursor: account.isActive ? 'default' : 'pointer',
                      borderRadius: '4px',
                      fontSize: '13px',
                      opacity: account.isActive ? 0.6 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      {account.name || account.email}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {account.email}
                    </div>
                    {account.isActive && (
                      <div style={{ fontSize: '11px', color: '#007bff', marginTop: '2px' }}>
                        ✓ Active
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!loading && accounts.length === 0 && !error && (
              <div style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                No other accounts
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid #eee',
                marginTop: '8px',
                paddingTop: '8px',
              }}
            >
              <button
                onClick={handleAddAccount}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: '#f0f7ff',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#007bff',
                  fontWeight: 'bold',
                }}
              >
                + Add account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
