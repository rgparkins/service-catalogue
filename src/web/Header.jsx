import React from 'react';
import { useAuth, hasGlobalAdmin } from './auth/AuthProvider.jsx';

export default function Header({
  mode = 'public', // 'public' | 'app' | 'tenant'
  tenantId = null,
  onScrollTo = null, // function(id)
} = {}) {
  const auth = useAuth();

  const NavLink = ({ href, children }) => (
    <a className="nav-link" href={href}>
      {children}
    </a>
  );

  const NavButton = ({ onClick, children, disabled }) => (
    <button className="nav-link btn btn-link" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );

  const loginLogout = auth.authenticated ? (
    <NavButton onClick={() => auth.logout()} disabled={!auth.ready}>
      Logout
    </NavButton>
  ) : (
    <NavButton onClick={() => auth.login()} disabled={!auth.ready}>
      Login
    </NavButton>
  );

  const commonPublic = (
    <>
      {onScrollTo ? (
        <>
          <NavButton onClick={() => onScrollTo('about')}>About us</NavButton>
          <NavButton onClick={() => onScrollTo('pricing')}>Pricing</NavButton>
        </>
      ) : (
        <NavLink href="/plans">Pricing</NavLink>
      )}
      {!auth.authenticated && <NavLink href="/register">Register</NavLink>}
      {loginLogout}
    </>
  );

  const commonApp = (
    <>
      <NavLink href="/tenants">Tenants</NavLink>
      {hasGlobalAdmin(auth.tokenParsed) ? <NavLink href="/admin">Admin</NavLink> : null}
      <NavLink href="/token">Token</NavLink>
      {loginLogout}
    </>
  );

  const title = (
    <a className="navbar-brand" href="/">
      Service Catalogue
    </a>
  );

  const nav =
    mode === 'public' ? commonPublic :
    mode === 'tenant' ? loginLogout :
    commonApp;

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom">
      <div className={mode === 'tenant' ? 'container-fluid px-3' : 'container'}>
        {title}
        {mode === 'tenant' && tenantId ? <div className="text-muted small">Tenant: {tenantId}</div> : null}
        <div className="navbar-nav ms-auto">{nav}</div>
      </div>
    </nav>
  );
}

