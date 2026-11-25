import { useState } from 'react';
import { Archive, Globe, QrCode, Wifi } from 'lucide-react';
import type { NetworkInfo } from '../types.ts';

interface StudioHeaderProps {
  activeTab: 'studio' | 'shares';
  onTabChange: (tab: 'studio' | 'shares') => void;
  sharesCount: number;
  networkInfo: NetworkInfo | null;
  shareBaseUrl: string;
  onShareBaseUrlChange: (url: string) => void;
}

export function StudioHeader({
  activeTab,
  onTabChange,
  sharesCount,
  networkInfo,
  shareBaseUrl,
  onShareBaseUrlChange
}: StudioHeaderProps) {
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(shareBaseUrl);

  const isLocalhost = shareBaseUrl.includes('localhost') || shareBaseUrl.includes('127.0.0.1');

  return (
    <header className="studio-header">
      <div className="header-inner">
        <div className="brand">
          <div className="pokeball-logo" aria-hidden="true">
            <span className="pokeball-top" />
            <span className="pokeball-band" />
            <span className="pokeball-center" />
          </div>
          <div>
            <h1>PokéQR Studio</h1>
            <p>Custom Pokémon QR Generator · Share Links &amp; Files</p>
          </div>
        </div>

        <nav className="header-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'studio' ? 'active' : ''}`}
            onClick={() => onTabChange('studio')}
          >
            <QrCode size={17} />
            <span>QR Studio</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'shares' ? 'active' : ''}`}
            onClick={() => onTabChange('shares')}
          >
            <Archive size={17} />
            <span>PC Box</span>
            <span className="pill-count">{sharesCount}</span>
          </button>
        </nav>

        <div className="network-picker-wrap">
          <button
            type="button"
            className={`network-btn ${isLocalhost ? 'warn-local' : ''}`}
            onClick={() => {
              setCustomUrlInput(shareBaseUrl);
              setShowNetworkMenu((v) => !v);
            }}
            title="Configure base URL encoded into file-sharing QR codes"
          >
            {isLocalhost ? <Globe size={15} /> : <Wifi size={15} />}
            <span className="network-btn-label">{shareBaseUrl.replace(/^https?:\/\//, '')}</span>
          </button>

          {showNetworkMenu && (
            <div className="network-popover" role="dialog" aria-label="Share Base URL settings">
              <div className="popover-title">Share Base URL (for Phone Scanning)</div>
              <p className="popover-desc">
                Phones on your Wi-Fi cannot reach <code>localhost</code>. Pick your LAN IP below or enter a public tunnel URL.
              </p>

              <div className="network-options">
                {networkInfo?.lanAddresses.map((lan) => (
                  <button
                    key={lan.url}
                    type="button"
                    className={`network-option ${shareBaseUrl === lan.url ? 'selected' : ''}`}
                    onClick={() => {
                      onShareBaseUrlChange(lan.url);
                      setShowNetworkMenu(false);
                    }}
                  >
                    <Wifi size={14} />
                    <div>
                      <div className="opt-url">{lan.url}</div>
                      <div className="opt-label">{lan.label}{lan.isPrimary ? ' · Recommended' : ''}</div>
                    </div>
                  </button>
                ))}
                {networkInfo && (
                  <button
                    type="button"
                    className={`network-option ${shareBaseUrl === networkInfo.requestOrigin ? 'selected' : ''}`}
                    onClick={() => {
                      onShareBaseUrlChange(networkInfo.requestOrigin);
                      setShowNetworkMenu(false);
                    }}
                  >
                    <Globe size={14} />
                    <div>
                      <div className="opt-url">{networkInfo.requestOrigin}</div>
                      <div className="opt-label">Current browser origin</div>
                    </div>
                  </button>
                )}
              </div>

              <div className="custom-url-row">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://your-domain-or-tunnel.com"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const cleaned = customUrlInput.trim().replace(/\/+$/, '');
                    if (cleaned) {
                      onShareBaseUrlChange(cleaned);
                      setShowNetworkMenu(false);
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
