import React from "react";
import {
  Activity,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileEdit,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Mail,
  Megaphone,
  Palmtree,
  Receipt,
  Settings,
  Sparkles,
  Users,
  UserSquare2,
  Award,
  Wallet,
  Clock,
} from "lucide-react";
import { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const MESSAGES: NavItem = { label: "Messages", href: "/messages", icon: Mail };
const EVENTS: NavItem = { label: "Events", href: "/events", icon: CalendarDays };
const MY_ATTENDANCE: NavItem = { label: "My Attendance", href: "/my-attendance", icon: Clock };
const LEAVE: NavItem = { label: "Leave", href: "/leave", icon: Palmtree };

const ADMIN: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Intelligence Engine", href: "/intelligence", icon: Activity, badge: "Live" },
      { label: "Action Center", href: "/actions", icon: CheckSquare },
    ],
  },
  {
    title: "People & Structure",
    items: [
      { label: "Students", href: "/students", icon: GraduationCap },
      { label: "Staff", href: "/staff", icon: UserSquare2 },
      { label: "Classes & Subjects", href: "/classes", icon: Layers },
      { label: "Academic Calendar", href: "/calendar", icon: Calendar },
      { label: "People (overview)", href: "/people", icon: Users },
    ],
  },
  {
    title: "Teaching & Learning",
    items: [
      { label: "Timetable", href: "/timetable", icon: CalendarDays },
      { label: "Daily Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Attendance Overview", href: "/attendance/overview", icon: ClipboardCheck },
      { label: "Staff Attendance", href: "/staff-attendance", icon: Clock },
      { label: "Results Approval", href: "/results/approvals", icon: CheckCircle2 },
      { label: "Grading Scale", href: "/results/grading", icon: Award },
      { label: "Academics & Grades", href: "/academics", icon: BookOpen },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Finance & Invoices", href: "/finance", icon: CreditCard },
      { label: "Paystack Payments", href: "/payments", icon: Receipt },
    ],
  },
  {
    title: "Community",
    items: [
      MESSAGES,
      { label: "Communications", href: "/communication", icon: Megaphone },
      EVENTS,
      LEAVE,
      { label: "AI School Assistant", href: "/ai", icon: Sparkles, badge: "AI" },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const TEACHER: NavSection[] = [
  {
    title: "My Work",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      MY_ATTENDANCE,
      { label: "Daily Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Timetable", href: "/timetable", icon: CalendarDays },
      { label: "Homework", href: "/assignments", icon: ClipboardList },
    ],
  },
  {
    title: "Results",
    items: [
      { label: "Results Entry", href: "/results/entry", icon: FileEdit },
      { label: "Class Teacher", href: "/results/class-teacher", icon: Users },
    ],
  },
  {
    title: "Community",
    items: [MESSAGES, EVENTS, LEAVE, { label: "AI School Assistant", href: "/ai", icon: Sparkles, badge: "AI" }],
  },
];

const STUDENT: NavSection[] = [
  {
    title: "My School",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Timetable", href: "/timetable", icon: CalendarDays },
      { label: "Homework", href: "/assignments", icon: ClipboardList },
      { label: "Results & Report Card", href: "/results/my", icon: GraduationCap },
      { label: "My Attendance", href: "/attendance/mine", icon: CalendarCheck },
      { label: "Fees", href: "/my-fees", icon: Wallet },
    ],
  },
  { title: "Community", items: [MESSAGES, EVENTS] },
];

const PARENT: NavSection[] = [
  {
    title: "My Children",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Results & Report Cards", href: "/results/my", icon: GraduationCap },
      { label: "Attendance", href: "/attendance/mine", icon: CalendarCheck },
      { label: "Fees & Invoices", href: "/finance", icon: CreditCard },
    ],
  },
  {
    title: "Community",
    items: [MESSAGES, { label: "Communications", href: "/communication", icon: Megaphone }, EVENTS, LEAVE],
  },
];

const BURSAR: NavSection[] = [
  {
    title: "Finance",
    items: [
      { label: "Finance & Invoices", href: "/finance", icon: CreditCard },
      { label: "Paystack Payments", href: "/payments", icon: Receipt },
      { label: "Intelligence Engine", href: "/intelligence", icon: Activity, badge: "Live" },
      { label: "Action Center", href: "/actions", icon: CheckSquare },
    ],
  },
  {
    title: "Community",
    items: [MY_ATTENDANCE, MESSAGES, { label: "Communications", href: "/communication", icon: Megaphone }, EVENTS, LEAVE, { label: "AI School Assistant", href: "/ai", icon: Sparkles, badge: "AI" }],
  },
];

const NON_ACADEMIC: NavSection[] = [
  { title: "My Work", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }, MY_ATTENDANCE, LEAVE, MESSAGES, EVENTS] },
];

export const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  owner: ADMIN,
  admin: ADMIN,
  teacher: TEACHER,
  student: STUDENT,
  parent: PARENT,
  bursar: BURSAR,
  non_academic: NON_ACADEMIC,
};

/** Where a role lands after signing in. */
export function homeRouteFor(role: UserRole): string {
  return role === "bursar" ? "/finance" : "/dashboard";
}
