export interface SettingsItem {
  id: string;
  label: string;
  icon: string;
  hasArrow: boolean;
  hasSwitch: boolean;
  value?: string;
}

export interface SettingsSection {
  id: number;
  category: string;
  items: SettingsItem[];
}

export const settingsOptions: SettingsSection[] = [
  {
    id: 1,
    category: "Account",
    items: [
      {
        id: "profile",
        label: "Edit Profile",
        icon: "👤",
        hasArrow: true,
        hasSwitch: false,
        value: undefined,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: "🔔",
        hasSwitch: true,
        hasArrow: false,
        value: undefined,
      },
      {
        id: "privacy",
        label: "Privacy Settings",
        icon: "🔒",
        hasArrow: true,
        hasSwitch: false,
        value: undefined,
      },
    ],
  },
  {
    id: 2,
    category: "Workout",
    items: [
      {
        id: "units",
        label: "Units",
        icon: "📏",
        value: "Metric",
        hasArrow: true,
        hasSwitch: false,
      },
      {
        id: "reminders",
        label: "Workout Reminders",
        icon: "⏰",
        hasSwitch: true,
        hasArrow: false,
        value: undefined,
      },
      {
        id: "auto-pause",
        label: "Auto-pause Workouts",
        icon: "⏸️",
        hasSwitch: true,
        hasArrow: false,
        value: undefined,
      },
    ],
  },
  {
    id: 3,
    category: "App",
    items: [
      {
        id: "theme",
        label: "Theme",
        icon: "🎨",
        value: "System",
        hasArrow: true,
        hasSwitch: false,
      },
      {
        id: "language",
        label: "Language",
        icon: "🌐",
        value: "English",
        hasArrow: true,
        hasSwitch: false,
      },
      {
        id: "about",
        label: "About",
        icon: "ℹ️",
        hasArrow: true,
        hasSwitch: false,
        value: undefined,
      },
      {
        id: "help",
        label: "Help & Support",
        icon: "❓",
        hasArrow: true,
        hasSwitch: false,
        value: undefined,
      },
    ],
  },
];
