'use client';

interface AddDomainStep2Props {
  scopes: {
    userIdentity: {
      openid: boolean;
      profile: boolean;
      email: boolean;
    };
    optional: {
      phone: boolean;
      address: boolean;
    };
  };
  onScopeToggle: (section: 'userIdentity' | 'optional', scope: string) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

const SCOPE_DESCRIPTIONS = {
  openid: 'OpenID Connect identity',
  profile: 'Basic profile info',
  email: 'Email address',
  phone: 'Phone number',
  address: 'Physical address',
};

export function AddDomainStep2({
  scopes,
  onScopeToggle,
  onNext,
  onBack,
  isLoading = false,
}: AddDomainStep2Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in space-y-4">
      {/* User Identity Section */}
      <div>
        <label style={{ color: 'var(--text-secondary)' }} className="block text-xs font-medium uppercase tracking-widest mb-2">
          User Identity
        </label>
        <div className="space-y-2">
          {Object.entries(scopes.userIdentity).map(([scopeId, checked]) => (
            <button
              key={scopeId}
              type="button"
              onClick={() => onScopeToggle('userIdentity', scopeId)}
              style={{
                backgroundColor: checked ? 'rgba(var(--blue-btn-rgb), 0.1)' : 'transparent',
                borderColor: checked ? 'var(--input-focus)' : 'var(--border)',
                color: checked ? 'var(--text)' : 'var(--text-secondary)',
              }}
              className="flex items-start gap-2 w-full px-3 py-2 rounded-lg border text-left transition-all hover:border-(--input-focus)"
            >
              <div
                style={{
                  backgroundColor: checked ? 'var(--blue-btn)' : 'transparent',
                  borderColor: checked ? 'var(--blue-btn)' : 'var(--border)',
                }}
                className="mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
              >
                {checked && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
              <div>
                <div style={{ color: 'var(--text)' }} className="text-xs font-medium font-mono leading-tight">
                  {scopeId}
                </div>
                <div style={{ color: 'var(--text-secondary)' }} className="text-[10px] mt-0.5 opacity-70">
                  {SCOPE_DESCRIPTIONS[scopeId as keyof typeof SCOPE_DESCRIPTIONS]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderColor: 'var(--border)' }} className="border-t" />

      {/* Optional Section */}
      <div>
        <label style={{ color: 'var(--text-secondary)' }} className="block text-xs font-medium uppercase tracking-widest mb-2">
          Optional
        </label>
        <div className="space-y-2">
          {Object.entries(scopes.optional).map(([scopeId, checked]) => (
            <button
              key={scopeId}
              type="button"
              onClick={() => onScopeToggle('optional', scopeId)}
              style={{
                backgroundColor: checked ? 'rgba(var(--blue-btn-rgb), 0.1)' : 'transparent',
                borderColor: checked ? 'var(--input-focus)' : 'var(--border)',
                color: checked ? 'var(--text)' : 'var(--text-secondary)',
              }}
              className="flex items-start gap-2 w-full px-3 py-2 rounded-lg border text-left transition-all hover:border-(--input-focus)"
            >
              <div
                style={{
                  backgroundColor: checked ? 'var(--blue-btn)' : 'transparent',
                  borderColor: checked ? 'var(--blue-btn)' : 'var(--border)',
                }}
                className="mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all"
              >
                {checked && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
              </div>
              <div>
                <div style={{ color: 'var(--text)' }} className="text-xs font-medium font-mono leading-tight">
                  {scopeId}
                </div>
                <div style={{ color: 'var(--text-secondary)' }} className="text-[10px] mt-0.5 opacity-70">
                  {SCOPE_DESCRIPTIONS[scopeId as keyof typeof SCOPE_DESCRIPTIONS]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          style={{ color: 'var(--blue)' }}
          className="text-sm font-medium transition-colors duration-200 hover:opacity-70"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          style={{
            backgroundColor: 'var(--blue-btn)',
          }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-white text-sm font-medium transition-all hover:bg-(--blue-btn-hover) disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </form>
  );
}
