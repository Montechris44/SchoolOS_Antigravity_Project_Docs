export interface PeopleField {
  key: string;
  label: string;
  type: "text" | "email" | "date" | "number" | "select";
  required: boolean;
  enabled: boolean;
  aliases: string[];
  options: string[];
}
export type PeopleKind = "student" | "teacher";
