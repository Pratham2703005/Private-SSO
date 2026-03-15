'use client';

interface AddDomainStep3Props {
  redirectUris: string;
  isActive: boolean;
  errors?: {
    redirect_uris?: string;
  };
  onRedirectUrisChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onIsActiveChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isLoading?: boolean;
  isEdit?: boolean;
}

export function AddDomainStep3({
  redirectUris,
  isActive,
  errors,
  onRedirectUrisChange,
  onIsActiveChange,
  onSubmit,
  onBack,
  isLoading = false,
  isEdit = false,
}: AddDomainStep3Props) {
  const buttonText = isEdit ? 'Update' : 'Register';
  const loadingText = isEdit ? 'Updating…' : 'Registering…';

  return (
    <form onSubmit={onSubmit} className="animate-fade-in space-y-4">
      {/* Error */}
      {errors?.redirect_uris && (
        <div
          style={{
            backgroundColor: 'rgba(var(--error-rgb), 0.1)',
            borderColor: 'var(--error)',
            color: 'var(--error)',
          }}
          className="flex items-center gap-2.5 px-3 py-2 border rounded-lg text-xs"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          {errors.redirect_uris}
        </div>
      )}

      {/* Active Checkbox */}
      <div className="flex items-center gap-3">
        <input
          id="is_active"
          type="checkbox"
          checked={isActive}
          onChange={onIsActiveChange}
          style={{
            accentColor: 'var(--blue)',
          }}
          className="w-4 h-4 cursor-pointer rounded border transition-colors focus:outline-none"
        />
        <label
          htmlFor="is_active"
          style={{ color: 'var(--text)' }}
          className="text-sm font-medium cursor-pointer"
        >
          Active
        </label>
        <span
          style={{ color: 'var(--text-secondary)' }}
          className="text-xs"
        >
          Enable this OAuth client immediately
        </span>
      </div>
      <div>
        <label
          htmlFor="redirect_uris"
          style={{ color: 'var(--text-secondary)' }}
          className="block text-xs font-medium uppercase tracking-widest mb-1.5"
        >
          Redirect URIs
          <span style={{ color: 'var(--error)' }} className="normal-case tracking-normal ml-0.5">
            *
          </span>
        </label>
        <textarea
          id="redirect_uris"
          value={redirectUris}
          onChange={onRedirectUrisChange}
          required
          rows={4}
          placeholder={"https://example.com/callback\nhttps://example.com/auth/callback"}
          style={{
            backgroundColor: 'var(--input-bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
          className="w-full px-3 py-2 border rounded-lg text-xs font-mono placeholder-(--text-secondary) focus:outline-none focus:ring-2 focus:ring-(--input-focus) focus:ring-opacity-20 focus:border-(--input-focus) transition-all resize-none"
        />
        <p style={{ color: 'var(--text-secondary)' }} className="mt-1 text-[10px] pl-1 opacity-70">
          One URI per line
        </p>
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
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-white text-xs font-medium transition-all hover:bg-(--blue-btn-hover) disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
              </svg>
              {loadingText}
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              {buttonText}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
