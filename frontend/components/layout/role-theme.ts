import { UserRole } from "@/types";

/**
 * Each portal has its own personality. Colours come from the [data-role] CSS variables in globals.css;
 * this file holds the structural choices (stationery, sidebar style, welcome tagline).
 */
export type SidebarStyle = "chalkboard" | "notebook" | "ledger" | "playful" | "floating";

export interface RoleTheme {
  portalName: string;
  tagline: string;
  /** Page background texture class (see globals.css) */
  backdrop: string;
  sidebar: SidebarStyle;
}

export const ROLE_THEME: Record<UserRole, RoleTheme> = {
  owner: { portalName: "Proprietor's Office", tagline: "The whole school at a glance", backdrop: "bg-grid-paper", sidebar: "chalkboard" },
  admin: { portalName: "Principal's Office", tagline: "Lead the school with confidence", backdrop: "bg-grid-paper", sidebar: "chalkboard" },
  bursar: { portalName: "Bursary", tagline: "Every kobo accounted for", backdrop: "bg-dotted", sidebar: "ledger" },
  teacher: { portalName: "Staffroom", tagline: "Teach, mark and inspire", backdrop: "bg-ruled", sidebar: "notebook" },
  non_academic: { portalName: "Staff Lounge", tagline: "Keeping the school running", backdrop: "bg-dotted", sidebar: "ledger" },
  student: { portalName: "Student Corner", tagline: "Learn. Grow. Shine.", backdrop: "bg-doodle", sidebar: "playful" },
  parent: { portalName: "Parents' Lounge", tagline: "Your child's school life, close to home", backdrop: "bg-warm-wash", sidebar: "floating" },
};

export const SIDEBAR_CLASSES: Record<
  SidebarStyle,
  { aside: string; brandName: string; brandSub: string; border: string; section: string; link: string; linkActive: string; icon: string; iconActive: string; footer: string }
> = {
  // Admin: a green chalkboard with gold chalk highlights.
  chalkboard: {
    aside: "chalkboard border-r border-white/10 text-white",
    brandName: "text-white",
    brandSub: "text-gold",
    border: "border-white/10",
    section: "text-white/40",
    link: "text-white/75 hover:bg-white/10 hover:text-white",
    linkActive: "bg-gold text-slate-900 font-bold shadow-[0_3px_0_0_rgb(0_0_0/0.25)]",
    icon: "text-white/50 group-hover:text-gold",
    iconActive: "text-slate-900",
    footer: "border-white/10 bg-white/5 text-white/70",
  },
  // Teacher: a notebook page with a red margin line.
  notebook: {
    aside: "bg-card border-r-2 border-brand/15 bg-ruled before:pointer-events-none before:absolute before:inset-y-0 before:left-[3.4rem] before:w-px before:bg-rose-300/70",
    brandName: "text-slate-900",
    brandSub: "text-brand",
    border: "border-slate-200",
    section: "text-brand/70",
    link: "text-slate-600 hover:bg-brand-soft hover:text-brand-strong",
    linkActive: "bg-brand-soft text-brand-strong font-bold ring-1 ring-brand/25 border-l-4 border-l-brand",
    icon: "text-slate-400 group-hover:text-brand",
    iconActive: "text-brand",
    footer: "border-slate-200 bg-card/80 text-slate-500",
  },
  // Bursar / support staff: a clean ledger — solid teal active rows.
  ledger: {
    aside: "bg-card border-r border-slate-200",
    brandName: "text-slate-900",
    brandSub: "text-brand",
    border: "border-slate-200",
    section: "text-slate-400",
    link: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    linkActive: "bg-brand text-white font-bold shadow-press-sm",
    icon: "text-slate-400 group-hover:text-slate-600",
    iconActive: "text-white",
    footer: "border-slate-200 bg-slate-50 text-slate-500",
  },
  // Student: loud, friendly and colourful.
  playful: {
    aside: "bg-brand text-white border-r-4 border-gold",
    brandName: "text-white",
    brandSub: "text-gold",
    border: "border-white/20",
    section: "text-white/60",
    link: "text-white/90 hover:bg-white/15 hover:text-white rounded-2xl",
    linkActive: "bg-white text-brand-strong font-black rounded-2xl shadow-[0_3px_0_0_rgb(0_0_0/0.2)] -rotate-1",
    icon: "text-white/70 group-hover:text-white",
    iconActive: "text-brand",
    footer: "border-white/20 bg-white/10 text-white/90",
  },
  // Parent: a soft floating card inset from the screen edge.
  floating: {
    aside: "bg-card/95 lg:m-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-3xl border border-brand/15 shadow-elevated",
    brandName: "text-slate-900",
    brandSub: "text-brand",
    border: "border-brand/10",
    section: "text-brand/60",
    link: "text-slate-600 hover:bg-brand-soft hover:text-brand-strong rounded-2xl",
    linkActive: "bg-gradient-to-r from-brand to-brand-strong text-white font-bold rounded-2xl shadow-md shadow-brand/30",
    icon: "text-slate-400 group-hover:text-brand",
    iconActive: "text-white",
    footer: "border-brand/10 bg-brand-soft/60 text-slate-500",
  },
};
