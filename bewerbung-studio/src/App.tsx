import {
  Archive,
  Bell,
  CalendarDays,
  ChevronDown,
  FileText,
  FolderArchive,
  Home,
  LayoutTemplate,
  ListTodo,
  Menu,
  MessageSquareText,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sun,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NewApplicationWizard } from "./components/NewApplicationWizard";
import { GlobalApplicationSearch } from "./components/GlobalApplicationSearch";
import { ApplicationsView } from "./views/ApplicationsView";
import { CalendarView } from "./views/CalendarView";
import { DashboardView } from "./views/DashboardView";
import { DocumentsView } from "./views/DocumentsView";
import { LibraryView } from "./views/LibraryView";
import { ProfileView } from "./views/ProfileView";
import { SettingsView } from "./views/SettingsView";
import { TemplatesView } from "./views/TemplatesView";
import { TodoView } from "./views/TodoView";
import { useAppStore } from "./store/useAppStore";
import { resolveSelectedProfile } from "./shared/profileSelection";
import type { WorkspaceStatus } from "./shared/ipc";
import { actionableTodos, activeTodos, isTodoOverdue, todoCounts } from "./shared/todos";

type View =
  | "home"
  | "active"
  | "interviews"
  | "rejections"
  | "calendar"
  | "todo"
  | "resume"
  | "cover"
  | "documents"
  | "templates"
  | "profile"
  | "settings";

const titles: Record<View, string> = {
  home: "Übersicht",
  active: "Aktive Bewerbungen",
  interviews: "Vorstellungsgespräche",
  rejections: "Absagen",
  calendar: "Kalender",
  todo: "ToDo",
  resume: "Lebenslauf",
  cover: "Anschreiben",
  documents: "Dokumente",
  templates: "Muster",
  profile: "Profil",
  settings: "Einstellungen",
};

export default function App() {
  const [workspaceStatus, setWorkspaceStatus] =
    useState<WorkspaceStatus | null>(null);
  const [setupError, setSetupError] = useState("");
  const [view, setView] = useState<View>("home");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hydrate = useAppStore((state) => state.hydrate);
  const workspace = useAppStore((state) => state.workspace);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const sidebarCollapsed = workspace.settings.sidebarCollapsed;
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const notice = useAppStore((state) => state.notice);
  const clearMessage = useAppStore((state) => state.clearMessage);
  const selectApplication = useAppStore((state) => state.selectApplication);
  const selectedApplicationId = useAppStore(
    (state) => state.selectedApplicationId,
  );
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeApplication = workspace.applications.find(
    (application) => application.id === selectedApplicationId,
  );
  const activeProfile = resolveSelectedProfile(
    workspace.profiles,
    selectedProfileId,
    activeApplication?.profileId,
  );

  useEffect(() => {
    if (!window.bewerbungsManager) {
      void hydrate();
      setWorkspaceStatus({ state: "ready", root: "" });
      return;
    }
    void window.bewerbungsManager.system
      .workspaceStatus()
      .then((status) => {
        setWorkspaceStatus(status);
        if (status.state === "ready") void hydrate();
      })
      .catch((error: unknown) =>
        setSetupError(
          error instanceof Error
            ? error.message
            : "Der Speicherort konnte nicht geladen werden.",
        ),
      );
  }, [hydrate]);

  const chooseWorkspace = async () => {
    setSetupError("");
    try {
      const status = await window.bewerbungsManager.system.chooseWorkspace();
      setWorkspaceStatus(status);
      if (status.state === "ready") await hydrate();
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Der Ordner konnte nicht eingerichtet werden.",
      );
    }
  };

  useEffect(() => {
    const theme = workspace.settings.theme;
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [workspace.settings.theme]);

  const darkMode = workspace.settings.theme === "dark" ||
    (workspace.settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  // Todos of a Bewerbung that is closed (Absage, Zusage, ...) are neither notified nor counted.
  const todoNotifications = useMemo(
    () => actionableTodos(activeTodos(workspace.todos, workspace.applications)),
    [workspace.todos, workspace.applications],
  );
  const openTodoCount = useMemo(
    () => todoCounts(workspace.todos, workspace.applications).open,
    [workspace.todos, workspace.applications],
  );
  const toggleTheme = () => void saveSettings({ ...workspace.settings, theme: darkMode ? "light" : "dark" });

  useEffect(() => {
    if (!error && !notice) return;
    const timeout = window.setTimeout(clearMessage, 4200);
    return () => window.clearTimeout(timeout);
  }, [clearMessage, error, notice]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [view]);

  const counts = useMemo(
    () => ({
      active: workspace.applications.filter(
        (application) =>
          !["Absage", "Zurückgezogen", "Archiviert"].includes(
            application.status,
          ),
      ).length,
      interviews: workspace.applications.filter((application) =>
        ["Vorstellungsgespräch", "Zweites Gespräch"].includes(
          application.status,
        ),
      ).length,
      rejections: workspace.applications.filter(
        (application) => application.status === "Absage",
      ).length,
    }),
    [workspace.applications],
  );

  const goToApplication = (id?: string) => {
    selectApplication(id);
    setView("active");
  };

  if (workspaceStatus?.state !== "ready") {
    return (
      <main className="workspace-setup">
        <div className="surface workspace-setup-card">
          <span className="eyebrow">BewerbungsManager</span>
          <h1>
            {workspaceStatus?.state === "missing"
              ? "Bewerbungsordner nicht gefunden"
              : workspaceStatus?.state === "error"
                ? "Bewerbungsordner kann nicht geladen werden"
                : "BewerbungsManager einrichten"}
          </h1>
          <p>
            {workspaceStatus?.state === "error"
              ? workspaceStatus.message
              : workspaceStatus?.state === "missing"
                ? "Der gespeicherte Bewerbungsordner wurde nicht gefunden. Wählen Sie den Ordner erneut aus."
                : "Wo sollen Ihre Bewerbungsunterlagen gespeichert werden?"}
          </p>
          {(workspaceStatus?.state === "missing" ||
            workspaceStatus?.state === "error") && (
            <div className="path-box">
              <code>{workspaceStatus.root}</code>
            </div>
          )}
          <p>
            Unter diesem Ordner werden Bewerbungen, Anschreiben, Lebensläufe und
            Backups automatisch organisiert.
          </p>
          {setupError && (
            <p role="alert" className="field-error">
              {setupError}
            </p>
          )}
          <button
            className="button primary"
            type="button"
            onClick={() => void chooseWorkspace()}>
            <FolderArchive size={18} /> Ordner auswählen
          </button>
          {(workspaceStatus?.state === "missing" ||
            workspaceStatus?.state === "error") && (
            <button
              className="button secondary"
              type="button"
              onClick={() => window.close()}>
              Abbrechen
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <span>BM</span>
          <div>
            <strong>Bewerbungs</strong>
            <small>Manager</small>
          </div>
          <button
            className="mobile-close"
            aria-label="Navigation schließen"
            onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <button
          className="sidebar-collapse"
          type="button"
          aria-label={
            sidebarCollapsed ? "Navigation ausklappen" : "Navigation einklappen"
          }
          aria-expanded={!sidebarCollapsed}
          title={
            sidebarCollapsed ? "Navigation ausklappen" : "Navigation einklappen"
          }
          onClick={() =>
            void saveSettings({
              ...workspace.settings,
              sidebarCollapsed: !sidebarCollapsed,
            })
          }>
          {sidebarCollapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
        <button
          className="button primary new-button"
          type="button"
          aria-label="Neue Bewerbung"
          title="Neue Bewerbung"
          onClick={() => setWizardOpen(true)}>
          <Plus size={18} /> <span>Neue Bewerbung</span>
        </button>
        <nav>
          <p>Übersicht</p>
          <NavItem
            icon={Home}
            label="Home"
            active={view === "home"}
            onClick={() => setView("home")}
          />
          <NavItem
            icon={CalendarDays}
            label="Kalender"
            active={view === "calendar"}
            onClick={() => setView("calendar")}
          />
          <NavItem
            icon={ListTodo}
            label="ToDo"
            badge={openTodoCount || undefined}
            active={view === "todo"}
            onClick={() => setView("todo")}
          />
          <p>Bewerbungen</p>
          <NavItem
            icon={FileText}
            label="Aktive Bewerbungen"
            badge={counts.active}
            active={view === "active"}
            onClick={() => setView("active")}
          />
          <NavItem
            icon={MessageSquareText}
            label="Vorstellungsgespräche"
            badge={counts.interviews}
            active={view === "interviews"}
            onClick={() => setView("interviews")}
          />
          <NavItem
            icon={XCircle}
            label="Absagen"
            badge={counts.rejections}
            active={view === "rejections"}
            onClick={() => setView("rejections")}
          />
          <p>Unterlagen</p>
          <NavItem
            icon={UserRound}
            label="Lebenslauf"
            active={view === "resume"}
            onClick={() => setView("resume")}
          />
          <NavItem
            icon={FileText}
            label="Anschreiben"
            active={view === "cover"}
            onClick={() => setView("cover")}
          />
          <NavItem
            icon={FolderArchive}
            label="Dokumente"
            active={view === "documents"}
            onClick={() => setView("documents")}
          />
          <NavItem
            icon={LayoutTemplate}
            label="Muster"
            active={view === "templates"}
            onClick={() => setView("templates")}
          />
        </nav>
        <div className="sidebar-footer">
          <NavItem
            icon={UserRound}
            label="Profil"
            active={view === "profile"}
            onClick={() => setView("profile")}
          />
          <NavItem
            icon={Settings}
            label="Einstellungen"
            active={view === "settings"}
            onClick={() => setView("settings")}
          />
        </div>
      </aside>
      <div
        className={`main-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="menu-button"
              aria-label="Navigation öffnen"
              onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <p className="eyebrow">BewerbungsManager</p>
              <h1>{titles[view]}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <GlobalApplicationSearch
              applications={workspace.applications}
              onSelect={goToApplication}
            />
            <div className="notification-menu">
              <button className="icon-button" type="button" aria-label="Benachrichtigungen"
                aria-expanded={notificationsOpen} title="Benachrichtigungen"
                onClick={() => setNotificationsOpen((value) => !value)}>
                <Bell size={18} />
                {todoNotifications.length ? <span className="notification-badge">{todoNotifications.length}</span> : null}
              </button>
              {notificationsOpen && <div className="notification-popover" role="dialog" aria-label="Benachrichtigungen">
                <header><strong>Benachrichtigungen</strong><small>{todoNotifications.length} aktuell</small></header>
                {todoNotifications.length ? todoNotifications.slice(0, 5).map((todo) => <button key={todo.id} type="button"
                  onClick={() => { setView("todo"); setNotificationsOpen(false); }}>
                  <span className={isTodoOverdue(todo) ? "notification-dot overdue" : "notification-dot"} />
                  <span><strong>{todo.title}</strong><small>{isTodoOverdue(todo) ? "Überfällig" : "Heute fällig"}</small></span>
                </button>) : <p>Keine neuen Benachrichtigungen</p>}
                <button className="notification-all" type="button" onClick={() => { setView("todo"); setNotificationsOpen(false); }}>Alle Aufgaben anzeigen</button>
              </div>}
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={darkMode ? "Zu Hell wechseln" : "Zu Dunkel wechseln"}
              onClick={toggleTheme}
              title={darkMode ? "Zu Hell wechseln" : "Zu Dunkel wechseln"}>
              {darkMode ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
            <button className="profile-chip" onClick={() => setView("profile")}>
              <span>{activeProfile?.firstName?.[0] || "P"}</span>
              <div>
                <strong>
                  {activeProfile
                    ? `${activeProfile.firstName} ${activeProfile.lastName}`
                    : "Profil anlegen"}
                </strong>
                <small>{activeProfile?.title || "Absenderdaten"}</small>
              </div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="content">
          {loading && !workspace.updatedAt ? (
            <Loading />
          ) : (
            <>
              {view === "home" && (
                <DashboardView
                  onOpenApplications={() => setView("active")}
                  onOpenCalendar={() => setView("calendar")}
                />
              )}
              {view === "active" && (
                <ApplicationsView
                  initialFilter="active"
                  onOpenResume={() => setView("resume")}
                  onOpenCover={() => setView("cover")}
                />
              )}
              {view === "interviews" && (
                <ApplicationsView key="interviews" initialFilter="interviews" />
              )}
              {view === "rejections" && (
                <ApplicationsView key="rejections" initialFilter="rejections" />
              )}
              {view === "calendar" && (
                <CalendarView onOpenApplication={goToApplication} />
              )}
              {view === "todo" && <TodoView onOpenApplication={goToApplication} />}
              {view === "resume" && (
                <DocumentsView
                  initialTab="lebenslauf"
                  onOpenApplications={() => setView("active")}
                />
              )}
              {view === "cover" && (
                <DocumentsView
                  initialTab="anschreiben"
                  onOpenApplications={() => setView("active")}
                />
              )}
              {view === "documents" && <LibraryView />}
              {view === "templates" && <TemplatesView />}
              {view === "profile" && (
                <ProfileView onSaved={() => setView("home")} />
              )}
              {view === "settings" && <SettingsView />}
            </>
          )}
        </main>
      </div>
      {wizardOpen && (
        <NewApplicationWizard onClose={() => setWizardOpen(false)} />
      )}
      {loading && <div className="loading-line" />}
      {(error || notice) && (
        <button
          className={`toast ${error ? "error" : "success"}`}
          onClick={clearMessage}>
          {error || notice}
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: typeof Archive;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      title={label}
      onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
      {badge !== undefined && <em>{badge}</em>}
    </button>
  );
}

function Loading() {
  return (
    <div className="loading-state">
      <span />
      <p>Daten werden sicher geladen …</p>
    </div>
  );
}
