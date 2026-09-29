let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("bewerbungsManager", {
	workspace: { get: () => electron.ipcRenderer.invoke("workspace:get") },
	applicationDraft: {
		get: () => electron.ipcRenderer.invoke("application-draft:get"),
		save: (draft) => electron.ipcRenderer.invoke("application-draft:save", draft),
		clear: () => electron.ipcRenderer.invoke("application-draft:clear")
	},
	applications: {
		create: (input) => electron.ipcRenderer.invoke("applications:create", input),
		save: (application) => electron.ipcRenderer.invoke("applications:save", application),
		remove: (id) => electron.ipcRenderer.invoke("applications:remove", id),
		duplicate: (id) => electron.ipcRenderer.invoke("applications:duplicate", id),
		changeStatus: (id, status, reason) => electron.ipcRenderer.invoke("applications:change-status", id, status, reason),
		openFolder: (id) => electron.ipcRenderer.invoke("applications:open-folder", id)
	},
	profiles: {
		save: (profile) => electron.ipcRenderer.invoke("profiles:save", profile),
		remove: (id) => electron.ipcRenderer.invoke("profiles:remove", id)
	},
	templates: {
		scan: () => electron.ipcRenderer.invoke("templates:scan"),
		add: (input) => electron.ipcRenderer.invoke("templates:add", input),
		use: (input) => electron.ipcRenderer.invoke("templates:use", input),
		syncAnschreiben: (applicationId) => electron.ipcRenderer.invoke("templates:sync-anschreiben", applicationId),
		duplicate: (templateId) => electron.ipcRenderer.invoke("templates:duplicate", templateId),
		copyToMuster: (templateId) => electron.ipcRenderer.invoke("templates:copy-to-muster", templateId),
		toggleFavorite: (templateId) => electron.ipcRenderer.invoke("templates:toggle-favorite", templateId),
		remove: (templateId) => electron.ipcRenderer.invoke("templates:remove", templateId),
		open: (templateId) => electron.ipcRenderer.invoke("templates:open", templateId),
		openFolder: (templateId) => electron.ipcRenderer.invoke("templates:open-folder", templateId)
	},
	media: { pickProfileImage: (kind) => electron.ipcRenderer.invoke("media:pick-profile-image", kind) },
	settings: { save: (settings) => electron.ipcRenderer.invoke("settings:save", settings) },
	events: { save: (event) => electron.ipcRenderer.invoke("events:save", event) },
	todos: {
		save: (todo) => electron.ipcRenderer.invoke("todos:save", todo),
		remove: (id) => electron.ipcRenderer.invoke("todos:remove", id)
	},
	customCvDesigns: {
		save: (design) => electron.ipcRenderer.invoke("custom-cv-designs:save", design),
		remove: (id) => electron.ipcRenderer.invoke("custom-cv-designs:remove", id)
	},
	attachments: {
		add: (applicationId, category) => electron.ipcRenderer.invoke("attachments:add", applicationId, category),
		save: (attachment) => electron.ipcRenderer.invoke("attachments:save", attachment),
		move: (id, direction) => electron.ipcRenderer.invoke("attachments:move", id, direction),
		remove: (id) => electron.ipcRenderer.invoke("attachments:remove", id),
		open: (id) => electron.ipcRenderer.invoke("attachments:open", id)
	},
	export: {
		pdf: (applicationId, target, application) => electron.ipcRenderer.invoke("export:pdf", applicationId, target, application),
		backup: () => electron.ipcRenderer.invoke("export:backup"),
		importBackup: () => electron.ipcRenderer.invoke("export:import-backup"),
		settings: () => electron.ipcRenderer.invoke("export:settings"),
		importSettings: () => electron.ipcRenderer.invoke("export:import-settings")
	},
	migration: { importLegacy: () => electron.ipcRenderer.invoke("migration:import-legacy") },
	system: {
		openExternal: (url) => electron.ipcRenderer.invoke("system:open-external", url),
		dataPath: () => electron.ipcRenderer.invoke("system:data-path"),
		workspaceStatus: () => electron.ipcRenderer.invoke("system:workspace-status"),
		chooseWorkspace: () => electron.ipcRenderer.invoke("system:choose-workspace"),
		openWorkspace: () => electron.ipcRenderer.invoke("system:open-workspace"),
		backupWorkspace: () => electron.ipcRenderer.invoke("system:backup-workspace"),
		openBackups: () => electron.ipcRenderer.invoke("system:open-backups"),
		changeWorkspace: (mode) => electron.ipcRenderer.invoke("system:change-workspace", mode)
	}
});
//#endregion
