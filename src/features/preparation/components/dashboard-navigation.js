"use client";

import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Flame,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  UserRound,
} from "lucide-react";
import IconButton from "@/components/ui/icon-button";
import ThemeToggle from "@/components/ui/theme-toggle";

export function DashboardSidebar({
  user,
  mobileNavOpen,
  onCloseNavigation,
  userMenuOpen,
  onToggleUserMenu,
  onProfile,
  onChangePassword,
  onSignOut,
}) {
  return (
    <>
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation"
          className="mobile-scrim"
          onClick={onCloseNavigation}
          type="button"
        />
      ) : null}
      <aside className={`sidebar${mobileNavOpen ? " sidebar-open" : ""}`}>
        <a className="brand-lockup sidebar-brand" href="#overview" onClick={onCloseNavigation}>
          <span className="brand-mark">C</span><span>CAT PREP</span>
        </a>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation" className="side-nav">
          <a className="side-link active" href="#overview" onClick={onCloseNavigation}>
            <LayoutDashboard size={18} /> Overview <span className="nav-active-dot" />
          </a>
          {/* <a className="side-link" href="#daily-plan" onClick={onCloseNavigation}>
            <BookOpen size={18} /> Study plan
          </a>
          <a className="side-link" href="#analytics" onClick={onCloseNavigation}>
            <BarChart3 size={18} /> Progress
          </a> */}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><Flame size={17} /></span>
            <strong>Consistency beats intensity.</strong>
            <span>One focused session at a time.</span>
          </div>
          <div className="sidebar-user">
            <span className="avatar">{(user.fullName || user.username || "S").slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-user-copy">
              <strong>{user.fullName || user.username}</strong>
              <small>CAT candidate</small>
            </span>
            <button
              aria-label="Open profile menu"
              aria-expanded={userMenuOpen}
              className="sidebar-more"
              onClick={onToggleUserMenu}
              type="button"
            >
              <MoreHorizontal size={20} />
            </button>
            {userMenuOpen ? (
              <div className="user-menu">
                <button onClick={onProfile} type="button"><UserRound size={16} /> Edit profile</button>
                <button onClick={onChangePassword} type="button"><KeyRound size={16} /> Change password</button>
                <button onClick={onSignOut} type="button"><LogOut size={16} /> Sign out</button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}

export function DashboardHeader({ user, onProfile, onOpenNavigation }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton className="mobile-menu-button" label="Open navigation" onClick={onOpenNavigation}>
          <Menu size={21} />
        </IconButton>
        <span className="breadcrumb">MY WORKSPACE <span>/</span> OVERVIEW</span>
      </div>
      <div className="topbar-actions">
        <ThemeToggle />
        <span aria-hidden="true" className="topbar-divider" />
        <button className="topbar-profile" onClick={onProfile} type="button">
          <span className="avatar avatar-small">{(user.fullName || user.username || "S").slice(0, 1).toUpperCase()}</span>
          <span>{(user.fullName || user.username).split(" ")[0]}</span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}
